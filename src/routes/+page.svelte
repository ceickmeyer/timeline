<script>
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase.js'
  import { userSession, hasSubmitted, predictions } from '$lib/stores.js'
  import { formatDate, generateSessionId, dateToPosition, positionToDate } from '$lib/utils.js'
  import { browser } from '$app/environment'

  let name = ''
  let selectedDate: Date | null = null
  let showPredictions = false
  let timelineContainer: HTMLElement | null = null
  let resultsTimelineContainer: HTMLElement | null = null
  let timelineWidth = 800
  let isSubmitting = false
  let viewResultsClicked = false
  
  // Timeline bounds
  const startDate = new Date()
  const endDate = new Date('2029-01-20') // Presidential inauguration date
  
  // Initialize session
  onMount(() => {
    if (!browser) return
    
    let session = localStorage.getItem('predictionSession')
    if (!session) {
      session = generateSessionId()
      localStorage.setItem('predictionSession', session)
    }
    userSession.set(session)
    
    checkIfSubmitted()
    
    // Set timeline width based on container with a slight delay for proper sizing
    setTimeout(() => {
      if (timelineContainer) {
        timelineWidth = timelineContainer.offsetWidth - 120 // Account for timeline padding
      }
      if (resultsTimelineContainer) {
        timelineWidth = resultsTimelineContainer.offsetWidth - 120
      }
    }, 100)
  })
  
  async function checkIfSubmitted() {
    if (!browser) return
    
    const session = userSession
    let sessionValue: string | null = null
    const unsubscribe = session.subscribe(value => {
      sessionValue = value
    })
    unsubscribe()
    
    if (!sessionValue) return
    
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_session', sessionValue)
      .single()
    
    if (data) {
      hasSubmitted.set(true)
      showPredictions = true
      loadPredictions()
    }
  }
  
  async function loadPredictions() {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .order('prediction_date')
    
    if (data) {
      predictions.set(data)
    }
  }
  
  function handleTimelineClick(event: MouseEvent) {
    let hasSubmittedValue = false
    const unsubscribe = hasSubmitted.subscribe(value => {
      hasSubmittedValue = value
    })
    unsubscribe()
    
    if (hasSubmittedValue) return
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const clickX = event.clientX - rect.left - 60 // Account for timeline padding
    const clickedDate = positionToDate(clickX, startDate, endDate, timelineWidth)
    
    // Constrain to timeline bounds and set to noon to avoid timezone issues
    if (clickedDate >= startDate && clickedDate <= endDate) {
      selectedDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), clickedDate.getDate(), 12, 0, 0)
    }
  }
  
  async function submitPrediction() {
    if (!name.trim() || !selectedDate) return
    
    let sessionValue: string | null = null
    const unsubscribe = userSession.subscribe(value => {
      sessionValue = value
    })
    unsubscribe()
    
    isSubmitting = true
    
    const { data, error } = await supabase
      .from('predictions')
      .insert([
        {
          name: name.trim(),
          prediction_date: selectedDate.toISOString().split('T')[0],
          user_session: sessionValue
        }
      ])
    
    if (error) {
      alert('Error submitting prediction. Please try again.')
      console.error('Error:', error)
    } else {
      hasSubmitted.set(true)
      showPredictions = true
      loadPredictions()
    }
    
    isSubmitting = false
  }
  
  // Define types for prediction data
  interface Prediction {
    id?: string
    name: string
    prediction_date: string
    user_session?: string
  }
  
  interface LabelPosition {
    prediction: Prediction
    x: number
    y: number
    id: string
  }
  
  // Calculate non-overlapping positions for prediction labels
  function calculateLabelPositions(predictionsArray: Prediction[]): LabelPosition[] {
    const sorted = [...predictionsArray].sort((a, b) => 
      new Date(a.prediction_date).getTime() - new Date(b.prediction_date).getTime()
    )
    
    const labelWidth = 120
    const labelHeight = 50
    const minGap = 10
    const baseY = 80
    const positions: LabelPosition[] = []
    
    sorted.forEach(prediction => {
      const x = dateToPosition(
        new Date(prediction.prediction_date + 'T12:00:00'),
        startDate, endDate, timelineWidth
      ) + 60
      
      let y = baseY
      let placed = false
      let testY = baseY
      
      // Find non-overlapping Y position
      while (!placed && testY < 300) {
        let collision = false
        
        for (let pos of positions) {
          const xDiff = Math.abs(x - pos.x)
          const yDiff = Math.abs(testY - pos.y)
          
          if (xDiff < labelWidth && yDiff < labelHeight + minGap) {
            collision = true
            break
          }
        }
        
        if (!collision) {
          y = testY
          placed = true
        } else {
          testY += labelHeight + minGap
        }
      }
      
      positions.push({ 
        prediction, 
        x, 
        y,
        id: prediction.id || `${prediction.name}-${prediction.prediction_date}`
      })
    })
    
    return positions
  }
  
  // Reactive declarations for store values
  let hasSubmittedValue = false
  let predictionsValue: Prediction[] = []
  let selectedDateString = ''
  let labelPositions: LabelPosition[] = []
  
  $: hasSubmitted.subscribe(value => {
    hasSubmittedValue = value
  })
  
  $: predictions.subscribe(value => {
    predictionsValue = value
  })
  
  $: labelPositions = calculateLabelPositions(predictionsValue)
  
  // Update input when selectedDate changes (but not the other way around)
  $: if (selectedDate) {
    selectedDateString = selectedDate.toISOString().split('T')[0]
  }
  
  function resetPrediction() {
    selectedDate = null
    selectedDateString = ''
  }
  
  function handleDateInput(event: Event) {
    const inputDate = (event.target as HTMLInputElement).value
    if (inputDate) {
      selectedDate = new Date(inputDate + 'T12:00:00') // Set to noon to avoid timezone issues
    }
  }
  
  function viewResults() {
    viewResultsClicked = true
    loadPredictions()
  }
</script>

<div class="container">
  <div class="header">
    <h1>When Will He Die?</h1>
    <p class="subtitle">In Minecraft</p>
  </div>
  
  {#if !hasSubmittedValue && !viewResultsClicked}
    <div class="prediction-form">
      <div class="name-input">
        <label for="name">Your Name:</label>
        <input 
          id="name"
          type="text" 
          bind:value={name} 
          placeholder="Enter your name"
          maxlength="50"
        />
      </div>
      
      <div class="timeline-section">
        <h3>Click on the timeline to make your prediction:</h3>
        <div class="timeline-info">
          <span>Today: {formatDate(startDate)}</span>
          <span>End Date: January 20, 2029</span>
        </div>
        
        <div 
          class="timeline-container" 
          bind:this={timelineContainer}
          on:click={handleTimelineClick}
          on:keydown={(e) => e.key === 'Enter' && handleTimelineClick(e)}
          role="button"
          tabindex="0"
          aria-label="Click to select a date on the timeline"
        >
          <div class="timeline">
            <div class="timeline-track"></div>
            
            <!-- Year markers -->
            {#each Array.from({length: 5}, (_, i) => new Date(startDate.getFullYear() + i, 0, 1)) as yearDate}
              {#if yearDate <= endDate && yearDate > startDate}
                <div 
                  class="year-marker"
                  style="left: {dateToPosition(yearDate, startDate, endDate, timelineWidth) + 60}px; transform: translateX(-50%);"
                >
                  <div class="year-line"></div>
                  <div class="year-label">{yearDate.getFullYear()}</div>
                </div>
              {/if}
            {/each}
            
            <!-- Selected prediction -->
            {#if selectedDate}
              <div 
                class="prediction-marker user-prediction"
                style="left: {dateToPosition(selectedDate, startDate, endDate, timelineWidth) + 60}px"
              >
                <div class="marker-dot"></div>
                <div class="marker-label">{formatDate(selectedDate)}</div>
              </div>
            {/if}
          </div>
        </div>
        
        {#if selectedDate}
          <div class="selected-date">
            <p>Selected: <strong>{formatDate(selectedDate)}</strong></p>
            <div class="date-controls">
              <input 
                type="date" 
                value={selectedDateString}
                on:change={handleDateInput}
                min={startDate.toISOString().split('T')[0]}
                max={endDate.toISOString().split('T')[0]}
                class="date-input"
              />
              <button class="reset-btn" on:click={resetPrediction}>Choose Different Date</button>
            </div>
          </div>
        {/if}
      </div>
      
      <button 
        class="submit-btn"
        disabled={!name.trim() || !selectedDate || isSubmitting}
        on:click={submitPrediction}
      >
        {#if isSubmitting}
          Submitting...
        {:else}
          Submit Prediction
        {/if}
      </button>
      
      <div class="view-results-link">
        <button class="link-button" on:click={viewResults}>
          View results without voting →
        </button>
      </div>
    </div>
  {:else}
    <div class="results-section">
      
      <div class="timeline-container results-timeline" bind:this={resultsTimelineContainer}>
        <div class="timeline">
          <div class="timeline-track"></div>
          
          <!-- Year markers -->
          {#each Array.from({length: 5}, (_, i) => new Date(startDate.getFullYear() + i, 0, 1)) as yearDate}
            {#if yearDate <= endDate && yearDate > startDate}
              <div 
                class="year-marker"
                style="left: {dateToPosition(yearDate, startDate, endDate, timelineWidth) + 60}px; transform: translateX(-50%);"
              >
                <div class="year-line"></div>
                <div class="year-label">{yearDate.getFullYear()}</div>
              </div>
            {/if}
          {/each}
          
          <!-- SVG for arrows -->
          <svg class="arrows-svg">
            {#each labelPositions as pos, index}
              {@const startY = pos.y + 45}
              {@const endY = 370}
              {@const controlX = pos.x + (index % 2 === 0 ? -20 : 20)}
              {@const controlY = (startY + endY) / 2}
              
              <path 
                d="M {pos.x} {startY} Q {controlX} {controlY} {pos.x} {endY}"
                class="arrow-line"
                id="arrow-{pos.id}"
              />
              <polygon 
                points="{pos.x-4},{endY-5} {pos.x+4},{endY-5} {pos.x},{endY+3}"
                class="arrow-head"
              />
            {/each}
          </svg>
          
          <!-- Prediction labels -->
          {#each labelPositions as pos}
            <div 
              class="prediction-label"
              style="left: {pos.x - 60}px; top: {pos.y}px"
              role="button"
              tabindex="0"
              on:mouseenter={() => {
                const arrow = document.querySelector(`#arrow-${pos.id}`) as HTMLElement
                if (arrow) {
                  arrow.style.stroke = '#059669'
                  arrow.style.strokeWidth = '3'
                  arrow.style.opacity = '1'
                }
              }}
              on:mouseleave={() => {
                const arrow = document.querySelector(`#arrow-${pos.id}`) as HTMLElement
                if (arrow) {
                  arrow.style.stroke = '#10b981'
                  arrow.style.strokeWidth = '2'
                  arrow.style.opacity = '0.6'
                }
              }}
            >
              <div class="label-name">{pos.prediction.name}</div>
              <div class="label-date">{formatDate(new Date(pos.prediction.prediction_date + 'T12:00:00'))}</div>
            </div>
            
            <!-- Point on timeline -->
            <div 
              class="timeline-point"
              style="left: {pos.x}px"
            ></div>
          {/each}
        </div>
      </div>
      
      <div class="stats">
        <p><strong>Total Predictions:</strong> {predictionsValue.length}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }
  
  .header {
    text-align: center;
    margin-bottom: 50px;
    color: white;
  }
  
  .header h1 {
    color: white;
    margin-bottom: 16px;
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    letter-spacing: -0.02em;
  }
  
  .subtitle {
    color: rgba(255, 255, 255, 0.9);
    font-size: clamp(1rem, 2.5vw, 1.25rem);
    font-weight: 400;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .prediction-form {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 40px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.2);
    margin-bottom: 30px;
  }
  
  .name-input {
    margin-bottom: 30px;
  }
  
  .name-input label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #374151;
  }
  
  .name-input input {
    width: 100%;
    max-width: 300px;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.2s;
  }
  
  .name-input input:focus {
    outline: none;
    border-color: #2563eb;
  }
  
  .timeline-section h3 {
    color: #374151;
    margin-bottom: 15px;
  }
  
  .timeline-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    font-size: 0.9rem;
    color: #64748b;
  }
  
  .timeline-container {
    position: relative;
    height: 220px;
    margin: 30px 0;
    cursor: crosshair;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 16px;
    border: 2px dashed #cbd5e1;
    transition: all 0.3s ease;
    overflow: hidden;
  }
  
  .timeline-container:hover {
    border-color: #667eea;
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .timeline {
    position: relative;
    height: 100%;
    padding: 20px 50px;
  }
  
  .timeline-track {
    position: absolute;
    top: 53px;
    left: 60px;
    right: 60px;
    height: 6px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    border-radius: 3px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .year-marker {
    position: absolute;
    top: 48px;
  }
  
  .year-line {
    width: 3px;
    height: 16px;
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    margin: 0 auto 8px auto;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .year-label {
    font-size: 0.85rem;
    color: #475569;
    text-align: center;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  }
  
  .prediction-marker {
    position: absolute;
    transform: translateX(-50%);
    z-index: 10;
    top: 53px;
  }
  
  .user-prediction .marker-dot {
    width: 18px;
    height: 18px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    margin: 0 auto 8px auto;
    transform: translateY(-9px);
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: translateY(-9px) scale(1); }
    50% { transform: translateY(-9px) scale(1.1); }
  }
  
  .marker-label {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    text-align: center;
    min-width: 90px;
    transition: all 0.3s ease;
  }
  
  .user-prediction .marker-label {
    color: #dc2626;
    font-weight: 600;
  }
  
  .selected-date {
    text-align: center;
    margin: 30px 0;
    padding: 20px;
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border-radius: 12px;
    border: 1px solid #fecaca;
    animation: fadeInUp 0.5s ease;
  }
  
  .date-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-top: 15px;
    flex-wrap: wrap;
  }
  
  .date-input {
    padding: 8px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    background: white;
    transition: border-color 0.2s;
    min-width: 140px;
  }
  
  .date-input:focus {
    outline: none;
    border-color: #667eea;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .reset-btn {
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.8rem;
    cursor: pointer;
    margin-left: 12px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .reset-btn:hover {
    background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  .submit-btn {
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 18px 24px;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 30px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.3);
    position: relative;
    overflow: hidden;
  }
  
  .submit-btn:before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }
  
  .submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.4);
  }
  
  .submit-btn:hover:not(:disabled):before {
    left: 100%;
  }
  
  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  
  .submit-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  .results-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    padding: 40px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .results-section .timeline-container {
    height: 450px;
    cursor: default;
    border-style: solid;
    border-color: #e2e8f0;
    overflow: visible;
    position: relative;
  }
  
  .results-section .timeline-container:hover {
    transform: none;
    border-color: #e2e8f0;
  }
  
  .results-timeline .timeline-track {
    position: absolute;
    bottom: 80px;
    left: 60px;
    right: 60px;
    top: auto;
    height: 6px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    border-radius: 3px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .results-timeline .year-marker {
    position: absolute;
    top: auto;
    bottom: 55px;
  }
  
  .results-timeline .year-line {
    width: 3px;
    height: 16px;
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    margin: 8px auto 0 auto;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .results-timeline .year-label {
    font-size: 0.85rem;
    color: #475569;
    text-align: center;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
    margin-top: 4px;
  }
  
  /* SVG for arrows */
  .arrows-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
  }
  
  .arrow-line {
    stroke: #10b981;
    stroke-width: 2;
    fill: none;
    opacity: 0.6;
    transition: all 0.3s ease;
  }
  
  .arrow-head {
    fill: #10b981;
    opacity: 0.8;
  }
  
  /* Prediction labels in results */
  .prediction-label {
    position: absolute;
    background: white;
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border: 2px solid #10b981;
    z-index: 10;
    transition: all 0.3s ease;
    cursor: pointer;
    min-width: 100px;
    text-align: center;
  }
  
  .prediction-label:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    border-color: #059669;
    z-index: 20;
  }
  
  .label-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }
  
  .label-date {
    color: #64748b;
    font-size: 0.75rem;
    margin-top: 2px;
  }
  
  /* Timeline points */
  .timeline-point {
    position: absolute;
    bottom: 77px;
    width: 8px;
    height: 8px;
    background: #10b981;
    border: 2px solid white;
    border-radius: 50%;
    transform: translateX(-50%);
    z-index: 3;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .stats {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }
  
  /* View results link */
  .view-results-link {
    text-align: center;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
  }
  
  .link-button {
    background: none;
    border: none;
    color: #64748b;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 8px 12px;
    transition: all 0.2s ease;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  
  .link-button:hover {
    color: #667eea;
    transform: translateX(2px);
  }
</style>