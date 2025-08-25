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
  const endDate = new Date('2028-11-30')
  
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
        timelineWidth = timelineContainer.offsetWidth - 100
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
    const clickX = event.clientX - rect.left - 50 // Account for padding
    const clickedDate = positionToDate(clickX, startDate, endDate, timelineWidth)
    
    // Constrain to timeline bounds
    if (clickedDate >= startDate && clickedDate <= endDate) {
      selectedDate = clickedDate
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
  
  $: hasSubmitted.subscribe(value => {
    hasSubmittedValue = value
  })
  
  $: predictions.subscribe(value => {
    predictionsValue = value
  })
  
  function resetPrediction() {
    selectedDate = null
  }
</script>

<div class="container">
  <div class="header">
    <h1>Timeline Prediction Challenge</h1>
    <p class="subtitle">When do you think the event will happen? Make your prediction!</p>
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
          <span>Target: November 2028</span>
        </div>
        
        <div 
          class="timeline-container" 
          bind:this={timelineContainer}
          on:click={handleTimelineClick}
        >
          <div class="timeline">
            <div class="timeline-track"></div>
            
            <!-- Year markers -->
            {#each Array.from({length: 5}, (_, i) => new Date(startDate.getFullYear() + i, 0, 1)) as yearDate}
              {#if yearDate <= endDate}
                <div 
                  class="year-marker"
                  style="left: {dateToPosition(yearDate, startDate, endDate, timelineWidth) + 50}px"
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
                style="left: {dateToPosition(selectedDate, startDate, endDate, timelineWidth) + 50}px"
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
            <button class="reset-btn" on:click={resetPrediction}>Choose Different Date</button>
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
            {#if yearDate <= endDate}
              <div 
                class="year-marker"
                style="left: {dateToPosition(yearDate, startDate, endDate, timelineWidth) + 50}px"
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
              style="left: {dateToPosition(new Date(prediction.prediction_date), startDate, endDate, timelineWidth) + 50}px; top: {60 + (index % 3) * 40}px"
            >
              <div class="marker-dot"></div>
              <div class="marker-label">
                <div class="name">{prediction.name}</div>
                <div class="date">{formatDate(prediction.prediction_date)}</div>
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
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .header {
    text-align: center;
    margin-bottom: 40px;
  }
  
  .header h1 {
    color: #2563eb;
    margin-bottom: 10px;
    font-size: 2.5rem;
  }
  
  .subtitle {
    color: #64748b;
    font-size: 1.1rem;
  }
  
  .prediction-form {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
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
    height: 200px;
    margin: 20px 0;
    cursor: crosshair;
    background: #f8fafc;
    border-radius: 8px;
    border: 2px dashed #cbd5e1;
    transition: border-color 0.2s;
  }
  
  .timeline-container:hover {
    border-color: #2563eb;
  }
  
  .timeline {
    position: relative;
    height: 100%;
    padding: 20px 50px;
  }
  
  .timeline-track {
    position: absolute;
    top: 40px;
    left: 50px;
    right: 50px;
    height: 4px;
    background: #2563eb;
    border-radius: 2px;
  }
  
  .year-marker {
    position: absolute;
    top: 35px;
  }
  
  .year-line {
    width: 2px;
    height: 14px;
    background: #64748b;
    margin-bottom: 5px;
  }
  
  .year-label {
    font-size: 0.8rem;
    color: #64748b;
    text-align: center;
    margin-left: -15px;
    width: 30px;
  }
  
  .prediction-marker {
    position: absolute;
    transform: translateX(-50%);
  }
  
  .user-prediction .marker-dot {
    width: 16px;
    height: 16px;
    background: #dc2626;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    margin-bottom: 8px;
    transform: translateY(-6px);
  }
  
  .prediction-marker:not(.user-prediction) .marker-dot {
    width: 12px;
    height: 12px;
    background: #059669;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    margin-bottom: 5px;
    transform: translateY(-4px);
  }
  
  .marker-label {
    background: white;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
    text-align: center;
    min-width: 80px;
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
    margin: 20px 0;
    padding: 15px;
    background: #fef2f2;
    border-radius: 8px;
    border: 1px solid #fecaca;
  }
  
  .reset-btn {
    background: #6b7280;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    margin-left: 10px;
    transition: background-color 0.2s;
  }
  
  .reset-btn:hover {
    background: #4b5563;
  }
  
  .submit-btn {
    width: 100%;
    background: #2563eb;
    color: white;
    border: none;
    padding: 16px;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 20px;
    transition: all 0.2s;
  }
  
  .submit-btn:hover:not(:disabled) {
    background: #1d4ed8;
    transform: translateY(-1px);
  }
  
  .submit-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
  }
  
  .results-section {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
  }
  
  .results-section h2 {
    color: #059669;
    text-align: center;
    margin-bottom: 10px;
  }
  
  .results-subtitle {
    text-align: center;
    color: #64748b;
    margin-bottom: 30px;
  }
  
  .results-section .timeline-container {
    height: 250px;
    cursor: default;
    border-style: solid;
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