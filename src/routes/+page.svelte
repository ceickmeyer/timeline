<script>
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase.js'
  import { userSession, hasSubmitted, predictions } from '$lib/stores.js'
  import { formatDate, generateSessionId, dateToPosition, positionToDate } from '$lib/utils.js'
  import { browser } from '$app/environment'

  let name = ''
  let selectedDate = null
  let showPredictions = false
  let timelineContainer
  let timelineWidth = 800
  let isSubmitting = false
  
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
    }, 100)
  })
  
  async function checkIfSubmitted() {
    if (!browser) return
    
    const session = userSession
    let sessionValue
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
  
  function handleTimelineClick(event) {
    let hasSubmittedValue
    const unsubscribe = hasSubmitted.subscribe(value => {
      hasSubmittedValue = value
    })
    unsubscribe()
    
    if (hasSubmittedValue) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - rect.left - 60 // Account for timeline padding
    const clickedDate = positionToDate(clickX, startDate, endDate, timelineWidth)
    
    // Constrain to timeline bounds and set to noon to avoid timezone issues
    if (clickedDate >= startDate && clickedDate <= endDate) {
      selectedDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), clickedDate.getDate(), 12, 0, 0)
    }
  }
  
  async function submitPrediction() {
    if (!name.trim() || !selectedDate) return
    
    let sessionValue
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
  
  // Reactive declarations for store values
  let hasSubmittedValue = false
  let predictionsValue = []
  let selectedDateString = ''
  
  $: hasSubmitted.subscribe(value => {
    hasSubmittedValue = value
  })
  
  $: predictions.subscribe(value => {
    predictionsValue = value
  })
  
  // Update input when selectedDate changes (but not the other way around)
  $: if (selectedDate) {
    selectedDateString = selectedDate.toISOString().split('T')[0]
  }
  
  function resetPrediction() {
    selectedDate = null
    selectedDateString = ''
  }
  
  function handleDateInput(event) {
    const inputDate = event.target.value
    if (inputDate) {
      selectedDate = new Date(inputDate + 'T12:00:00') // Set to noon to avoid timezone issues
    }
  }
</script>

<div class="container">
  <div class="header">
    <h1>When Will He Die?</h1>
    <p class="subtitle">In Minecraft</p>
  </div>
  
  {#if !hasSubmittedValue}
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
          <span>Target: January 20, 2029</span>
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
    </div>
  {:else}
    <div class="results-section">
      <h2>All Predictions</h2>
      <p class="results-subtitle">Here's what everyone predicted:</p>
      
      <div class="timeline-container">
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
          
          <!-- All predictions -->
          {#each predictionsValue as prediction, index}
            <div 
              class="prediction-marker"
              style="left: {dateToPosition(new Date(prediction.prediction_date + 'T12:00:00'), startDate, endDate, timelineWidth) + 60}px; top: {70 + (index % 3) * 40}px"
            >
              <div class="marker-dot"></div>
              <div class="marker-label">
                <div class="name">{prediction.name}</div>
                <div class="date">{formatDate(new Date(prediction.prediction_date + 'T12:00:00'))}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="stats">
        <p><strong>Total Predictions:</strong> {predictionsValue.length}</p>
        <p class="note">When the event occurs, we'll determine who came closest!</p>
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
  
  .today-marker, .end-marker {
    position: absolute;
    top: 30px;
  }
  
  .today-dot, .end-dot {
    width: 12px;
    height: 12px;
    border: 2px solid white;
    border-radius: 50%;
    margin: 8px auto 0 auto;
    transform: translateY(17px);
  }
  
  .today-dot {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    animation: todayPulse 3s infinite;
  }
  
  .end-dot {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  }
  
  @keyframes todayPulse {
    0%, 100% { transform: translateY(17px) scale(1); opacity: 1; }
    50% { transform: translateY(17px) scale(1.1); opacity: 0.8; }
  }
  
  .today-label, .end-label {
    font-size: 0.7rem;
    text-align: center;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    margin-bottom: 8px;
  }
  
  .today-label {
    color: #16a34a;
  }
  
  .end-label {
    color: #d97706;
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
  
  .prediction-marker:not(.user-prediction) .marker-dot {
    width: 14px;
    height: 14px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    margin: 0 auto 5px auto;
    transform: translateY(-4px);
    transition: all 0.3s ease;
  }
  
  .prediction-marker:not(.user-prediction):hover .marker-dot {
    transform: translateY(-4px) scale(1.2);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
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
  
  .prediction-marker:not(.user-prediction) .marker-label:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
  
  .user-prediction .marker-label {
    color: #dc2626;
    font-weight: 600;
  }
  
  .prediction-marker:not(.user-prediction) .marker-label .name {
    font-weight: 600;
    color: #374151;
  }
  
  .prediction-marker:not(.user-prediction) .marker-label .date {
    color: #64748b;
    font-size: 0.7rem;
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
  
  .results-section h2 {
    color: #10b981;
    text-align: center;
    margin-bottom: 16px;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    font-weight: 700;
  }
  
  .results-subtitle {
    text-align: center;
    color: #64748b;
    margin-bottom: 40px;
    font-size: 1.1rem;
  }
  
  .results-section .timeline-container {
    height: 280px;
    cursor: default;
    border-style: solid;
    border-color: #e2e8f0;
  }
  
  .results-section .timeline-container:hover {
    transform: none;
    border-color: #e2e8f0;
  }
  
  .stats {
    text-align: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }
  
  .stats .note {
    color: #64748b;
    font-style: italic;
    margin-top: 10px;
  }
</style>