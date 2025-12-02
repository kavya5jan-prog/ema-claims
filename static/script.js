const fileInput = document.getElementById('fileInput');
const bulkFileInput = document.getElementById('bulkFileInput');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const fileListContainer = document.getElementById('fileListContainer');
const fileList = document.getElementById('fileList');
const fileContentView = document.getElementById('fileContentView');
const factMatrixView = document.getElementById('factMatrixView');
const metadataDiv = document.getElementById('metadata');
const pagesDiv = document.getElementById('pages');
const factTableBody = document.getElementById('factTableBody');
const conflictsContent = document.getElementById('conflictsContent');
const acceptedDecisionsSection = document.getElementById('acceptedDecisionsSection');

// Step 1 completion tracking
let step1Completion = {
    factsExtracted: false,
    liabilitySignals: false,
    evidenceComplete: false
};

// Step definitions in order
const steps = [
    { id: 'files', name: 'Review', requires: [] },
    { id: 'fact-matrix', name: 'Fact Matrix', requires: ['files'] },
    { id: 'timeline', name: 'Timeline Reconstruction', requires: ['fact-matrix'] },
    { id: 'liability-recommendation', name: 'Liability % Recommendation', requires: ['timeline'] },
    { id: 'claim-rationale', name: 'Draft Claim Rationale', requires: ['fact-matrix'] }
];

let currentStepIndex = 0;

// Store current facts data
let currentFactsData = null;
let currentLiabilitySignalsData = null;
let currentLiabilityRecommendationData = null;
let currentTimelineData = null;
let currentClaimRationaleData = null;
let currentEscalationPackageData = null;
let isEscalatedToSupervisor = false;

// Store missing evidence and email tracking
let currentMissingEvidence = [];
let sentEmails = {}; // Track sent emails by evidence item

// Mapping function to convert evidence_needed strings to checkItem keys
function mapEvidenceNeededToKey(evidenceNeeded) {
    if (!evidenceNeeded) return 'unknown';
    
    const normalized = evidenceNeeded.toLowerCase().trim();
    
    // Map common evidence_needed strings to checkItem keys
    const mapping = {
        'turn-by-turn incident photos': 'turn_by_turn_photos',
        'turn by turn incident photos': 'turn_by_turn_photos',
        'turn-by-turn photos': 'turn_by_turn_photos',
        'turn by turn photos': 'turn_by_turn_photos',
        'vehicle damage angles': 'vehicle_damage_angles',
        'vehicle damage': 'vehicle_damage_angles',
        'damage angles': 'vehicle_damage_angles',
        'timestamps & location data': 'timestamps_location',
        'timestamps and location data': 'timestamps_location',
        'timestamps': 'timestamps_location',
        'location data': 'timestamps_location',
        'police report': 'police_report',
        'driver statements': 'driver_statements',
        'document metadata': 'document_metadata'
    };
    
    // Check for exact match first
    if (mapping[normalized]) {
        return mapping[normalized];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(mapping)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value;
        }
    }
    
    return 'unknown';
}

// Predefined list of files to upload
const expectedFiles = [
    { name: 'accident_images.png', type: 'image', displayName: 'Accident Images' },
    { name: 'fnol.pdf', type: 'pdf', displayName: 'First Notice of Loss' },
    { name: 'claimant_statement.pdf', type: 'pdf', displayName: 'Claimant Statement' },
    { name: 'other_driver_statement.pdf', type: 'pdf', displayName: 'Other Driver Statement' },
    { name: 'police_report.pdf', type: 'pdf', displayName: 'Police Report' },
    { name: 'repair_estimate.pdf', type: 'pdf', displayName: 'Repair Estimate' },
    { name: 'state_negligence_rules.pdf', type: 'pdf', displayName: 'State Negligence Rules' },
    { name: 'policy_document.pdf', type: 'pdf', displayName: 'Policy Document' }
];

// Store uploaded files data (keyed by expected file name)
const uploadedFiles = {};

// Load sample files on page load
async function loadSampleFiles() {
    const loadingIndicator = document.getElementById('fileListLoading');
    const fileList = document.getElementById('fileList');
    
    try {
        // Show loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        if (fileList) {
            fileList.style.display = 'none';
        }
        
        // Get list of sample files
        const listResponse = await fetch('/list-sample-files');
        const listData = await listResponse.json();
        
        if (listData.error) {
            console.error('Failed to list sample files:', listData.error);
            // Hide loading indicator on error
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            if (fileList) {
                fileList.style.display = 'block';
            }
            return;
        }
        
        const sampleFiles = listData.files || [];
        if (sampleFiles.length === 0) {
            // Hide loading indicator if no files to load
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            if (fileList) {
                fileList.style.display = 'block';
            }
            return; // No sample files to load
        }
        
        // Load each sample file
        const loadPromises = sampleFiles.map(async (filename) => {
            try {
                const loadResponse = await fetch(`/load-sample-file/${encodeURIComponent(filename)}`);
                const fileData = await loadResponse.json();
                
                if (loadResponse.ok && !fileData.error) {
                    // First, try to match by exact filename in expectedFiles
                    let expectedFile = expectedFiles.find(f => f.name.toLowerCase() === filename.toLowerCase());
                    
                    // If no exact match, try to match by filename similarity (e.g., "Sample policy.pdf" -> "policy_document.pdf")
                    if (!expectedFile) {
                        const filenameLower = filename.toLowerCase();
                        if (filenameLower.includes('policy')) {
                            expectedFile = expectedFiles.find(f => f.name === 'policy_document.pdf');
                        } else if (filenameLower.includes('fnol') || filenameLower.includes('first notice')) {
                            expectedFile = expectedFiles.find(f => f.name === 'fnol.pdf');
                        }
                    }
                    
                    // If still no match, try by detected type
                    if (!expectedFile) {
                        const detectedType = fileData.detected_source || 'unknown';
                        const isRelevant = fileData.is_relevant || false;
                        expectedFile = findExpectedFileForType(detectedType, filename);
                    }
                    
                    if (expectedFile && !uploadedFiles[expectedFile.name]) {
                        // Store uploaded file data with expected file name
                        fileData.expectedFileName = expectedFile.name;
                        fileData.originalFilename = filename;
                        uploadedFiles[expectedFile.name] = fileData;
                    } else {
                        // Store with original filename if no match found or already exists
                        const key = filename;
                        fileData.expectedFileName = key;
                        fileData.originalFilename = filename;
                        // Mark as miscellaneous if relevant but unmatched
                        if (fileData.is_relevant && !expectedFile) {
                            fileData.is_miscellaneous = true;
                        }
                        uploadedFiles[key] = fileData;
                    }
                } else {
                    console.error(`Failed to load sample file ${filename}:`, fileData.error);
                }
            } catch (err) {
                console.error(`Error loading sample file ${filename}:`, err);
            }
        });
        
        // Wait for all files to load
        await Promise.all(loadPromises);
        
        // Hide loading indicator when done
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        if (fileList) {
            fileList.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading sample files:', err);
        // Hide loading indicator on error
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        if (fileList) {
            fileList.style.display = 'block';
        }
    }
}

// Initialize file list on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load sample files first, then render
    try {
        await loadSampleFiles();
    } catch (err) {
        console.error('Error loading sample files:', err);
    }
    
    // Always render file list, even if loading failed
    renderFileList();
    updateStep2Access(); // Initialize Step 2 button state
    updateStepIndicators();
    updateProgress();
    updateNavigationButtons();
    // Load timeline if available
    loadTimeline();
    
    // Automatically check evidence completeness if files are already loaded
    if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
        // Small delay to ensure UI is ready
        setTimeout(() => {
            checkEvidenceCompleteness();
        }, 300);
    }
});

// Helper function to check if there's at least one fact
function hasAtLeastOneFact() {
    return currentFactsData && 
           currentFactsData.facts && 
           Array.isArray(currentFactsData.facts) && 
           currentFactsData.facts.length > 0;
}

// Check if a step is completed
function isStepCompleted(stepId) {
    switch(stepId) {
        case 'files':
            return Object.keys(uploadedFiles).length > 0;
        case 'fact-matrix':
            return step1Completion.factsExtracted;
        case 'liability-recommendation':
            return currentLiabilityRecommendationData !== null;
        case 'timeline':
            return currentTimelineData !== null;
        case 'claim-rationale':
            return currentClaimRationaleData !== null;
        default:
            return false;
    }
}

// Check if a step is accessible (all requirements met)
function isStepAccessible(stepId) {
    const step = steps.find(s => s.id === stepId);
    if (!step) return false;
    
    // Check if all required steps are completed
    const requirementsMet = step.requires.every(req => isStepCompleted(req));
    
    // For timeline and claim-rationale steps, also require at least one fact
    if ((stepId === 'timeline' || stepId === 'claim-rationale') && !hasAtLeastOneFact()) {
        return false;
    }
    
    // For timeline and claim-rationale steps, require all conflicts to be resolved
    if ((stepId === 'timeline' || stepId === 'claim-rationale')) {
        const allResolved = checkIfAllConflictsResolved();
        console.log(`DEBUG: isStepAccessible(${stepId}) - conflicts resolved: ${allResolved}`);
        if (!allResolved) {
            return false;
        }
    }
    
    return requirementsMet;
}

// Update step indicators based on current state
function updateStepIndicators() {
    steps.forEach((step, index) => {
        const stepElement = document.querySelector(`[data-step="${step.id}"]`);
        if (!stepElement) return;
        
        // Remove all state classes
        stepElement.classList.remove('completed', 'active', 'locked');
        
        const isCompleted = isStepCompleted(step.id);
        const isAccessible = isStepAccessible(step.id);
        const isActive = index === currentStepIndex;
        
        if (isCompleted) {
            stepElement.classList.add('completed');
        } else if (isActive) {
            stepElement.classList.add('active');
        } else if (!isAccessible) {
            stepElement.classList.add('locked');
        }
    });
}

// Update progress bar
function updateProgress() {
    const progressFill = document.getElementById('progressFill');
    if (!progressFill) return;
    
    // Calculate progress based on completed steps
    let completedCount = 0;
    const totalSteps = steps.length;
    
    steps.forEach(step => {
        if (isStepCompleted(step.id)) {
            completedCount++;
        }
    });
    
    // Calculate percentage (0-100)
    const progressPercentage = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
    
    // Update progress bar
    progressFill.style.width = `${progressPercentage}%`;
}

    // Tab switching function
function switchTab(tabName, skipLoadTimeline = false) {
    // Find step index
    const stepIndex = steps.findIndex(s => s.id === tabName);
    if (stepIndex === -1) return;
    
    // Check if step is accessible
    if (!isStepAccessible(tabName) && !isStepCompleted(tabName)) {
        // Special message for timeline and claim-rationale when no facts exist
        if ((tabName === 'timeline' || tabName === 'claim-rationale') && !hasAtLeastOneFact()) {
            showError('Please extract at least one fact before accessing this step.');
        } else if ((tabName === 'timeline' || tabName === 'claim-rationale')) {
            const allResolved = checkIfAllConflictsResolved();
            console.log(`DEBUG: switchTab(${tabName}) - conflicts resolved: ${allResolved}`);
            if (!allResolved) {
                showError('Please resolve all conflicts in the Fact Matrix before accessing this step.');
                return;
            }
        } else {
            showError('Please complete the previous steps first.');
        }
        return;
    }
    
    currentStepIndex = stepIndex;
    
    // Update step indicators
    updateStepIndicators();
    
    // Update progress bar
    updateProgress();
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });
    
    // Map tab names to IDs
    const tabIdMap = {
        'files': 'filesTab',
        'fact-matrix': 'factMatrixTab',
        'liability-recommendation': 'liabilityRecommendationTab',
        'timeline': 'timelineTab',
        'claim-rationale': 'claimRationaleTab'
    };
    
    // Load timeline when switching to timeline tab
    // Skip if we're displaying a newly generated timeline
    if (tabName === 'timeline' && !skipLoadTimeline) {
        // Check memory first, then localStorage, then show empty state
        if (currentTimelineData && currentTimelineData.timeline) {
            // Timeline exists in memory, display it
            displayTimeline(currentTimelineData);
        } else {
            // Try loading from localStorage or show empty state
            loadTimeline();
        }
    }
    
    const targetTabId = tabIdMap[tabName];
    if (targetTabId) {
        const targetTab = document.getElementById(targetTabId);
        if (targetTab) {
            targetTab.style.display = 'block';
            targetTab.classList.add('active');
        }
    }
    
    // Auto-display liability recommendation when switching to that tab if data exists
    if (tabName === 'liability-recommendation' && currentLiabilityRecommendationData) {
        displayLiabilityRecommendation(currentLiabilityRecommendationData, true);
    }
    
    // Hide file content view when switching tabs
    if (tabName === 'files') {
        fileContentView.style.display = 'none';
    }
    
    // Update navigation buttons
    updateNavigationButtons();
}

// Navigation functions
function goToPreviousStep() {
    if (currentStepIndex > 0) {
        const previousStep = steps[currentStepIndex - 1];
        switchTab(previousStep.id);
    }
}

function goToNextStep() {
    if (currentStepIndex < steps.length - 1) {
        const nextStep = steps[currentStepIndex + 1];
        
        // If we're on Files tab and going to Fact Matrix, automatically extract facts and analyze signals
        if (currentStepIndex === 0 && nextStep.id === 'fact-matrix') {
            // Check if facts are already extracted
            if (step1Completion.factsExtracted && currentFactsData) {
                // Facts already extracted, just switch tab
                switchTab(nextStep.id);
                // If signals not analyzed yet, analyze them
                if (!step1Completion.liabilitySignals) {
                    analyzeLiabilitySignals();
                }
            } else {
                // Extract facts first, then analyze signals
                extractFactsAndSignals();
            }
        } else if (currentStepIndex === 1 && nextStep.id === 'timeline') {
            // If we're on Fact Matrix tab and going to Timeline, check for conflicts first
            console.log('DEBUG: ========== goToNextStep - checking conflicts before timeline ==========');
            console.log('DEBUG: currentFactsData exists:', !!currentFactsData);
            console.log('DEBUG: currentFactsData:', currentFactsData);
            console.log('DEBUG: conflicts exists:', !!currentFactsData?.conflicts);
            console.log('DEBUG: conflicts:', currentFactsData?.conflicts);
            console.log('DEBUG: conflicts length:', currentFactsData?.conflicts?.length);
            console.log('DEBUG: conflicts is array:', Array.isArray(currentFactsData?.conflicts));
            console.log('DEBUG: acceptedVersions exists:', !!currentFactsData?.acceptedVersions);
            console.log('DEBUG: acceptedVersions:', currentFactsData?.acceptedVersions);
            
            if (currentFactsData && currentFactsData.conflicts && currentFactsData.conflicts.length > 0) {
                // Check if all conflicts are resolved
                console.log('DEBUG: About to call checkIfAllConflictsResolved()');
                const allResolved = checkIfAllConflictsResolved();
                console.log('DEBUG: All conflicts resolved check result:', allResolved);
                console.log('DEBUG: Result type:', typeof allResolved);
                
                if (!allResolved) {
                    console.log('DEBUG: Blocking navigation - conflicts not resolved');
                    console.log('DEBUG: Current state:');
                    console.log('  - Conflicts count:', currentFactsData.conflicts.length);
                    console.log('  - Accepted versions count:', currentFactsData.acceptedVersions ? Object.keys(currentFactsData.acceptedVersions).length : 0);
                    console.log('  - Accepted versions keys:', currentFactsData.acceptedVersions ? Object.keys(currentFactsData.acceptedVersions) : 'none');
                    showError('Please resolve conflicts before proceeding.');
                    return;
                } else {
                    console.log('DEBUG: All conflicts resolved, allowing navigation');
                }
            } else {
                console.log('DEBUG: No conflicts found, allowing navigation');
            }
            console.log('DEBUG: ========== goToNextStep conflict check complete ==========');
            // If we're on Fact Matrix tab and going to Timeline, automatically trigger timeline generation
            // which will also generate liability recommendation
            // If conflicts are resolved (or there are no conflicts) and we have facts, allow navigation
            if (checkIfAllConflictsResolved() && hasAtLeastOneFact()) {
                generateTimeline();
            } else if (isStepAccessible(nextStep.id) || isStepCompleted(nextStep.id)) {
                generateTimeline();
            } else {
                showError('Please complete the current step first.');
            }
        } else if (currentStepIndex === 2 && nextStep.id === 'liability-recommendation') {
            // If we're on Timeline tab and going to Liability Recommendation
            // Allow forward navigation from timeline even if it's not marked as "completed"
            // This matches the logic in updateNavigationButtons() for problematic steps
            const currentStepId = steps[currentStepIndex].id;
            const isProblematicStep = currentStepId === 'timeline' || 
                                     currentStepId === 'liability-recommendation' || 
                                     currentStepId === 'claim-rationale';
            
            // Allow navigation if step is accessible/completed OR if we're on a problematic step
            if (isStepAccessible(nextStep.id) || isStepCompleted(nextStep.id) || isProblematicStep) {
                // If recommendation data doesn't exist, generate it first
                if (!currentLiabilityRecommendationData) {
                    generateLiabilityRecommendationForTab();
                } else {
                    // Data exists, just switch to the tab (which will auto-display it)
                    switchTab(nextStep.id);
                }
            } else {
                showError('Please complete the current step first.');
            }
        } else if (currentStepIndex === 3 && nextStep.id === 'claim-rationale') {
            // If we're on Liability Recommendation tab and going to Claim Rationale, 
            // switch to the tab first, then generate the rationale
            switchTab(nextStep.id);
            // Generate claim rationale after switching to the tab
            generateClaimRationale();
        } else if (isStepAccessible(nextStep.id) || isStepCompleted(nextStep.id)) {
            switchTab(nextStep.id);
        } else {
            showError('Please complete the current step first.');
        }
    }
}

// Update navigation buttons state
function updateNavigationButtons() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    
    if (prevButton) {
        prevButton.disabled = currentStepIndex === 0;
    }
    
    if (nextButton) {
        // Hide next button on claim rationale tab (last step)
        if (currentStepIndex === steps.length - 1 || steps[currentStepIndex].id === 'claim-rationale') {
            nextButton.style.display = 'none';
        } else {
            nextButton.style.display = 'inline-block';
            // Enable next button if we're on files tab and have at least one file uploaded
            if (currentStepIndex === 0) {
                const hasUploadedFiles = Object.keys(uploadedFiles).length > 0;
                nextButton.disabled = !hasUploadedFiles;
            } else if (currentStepIndex === 1 && steps[currentStepIndex].id === 'fact-matrix') {
                // On fact-matrix tab, disable Next button if there are no facts
                const hasFacts = hasAtLeastOneFact();
                nextButton.disabled = !hasFacts;
            } else {
                const nextStep = steps[currentStepIndex + 1];
                const currentStepId = steps[currentStepIndex].id;
                
                // For timeline, liability-recommendation, and claim-rationale screens,
                // allow forward navigation if user is on the screen (they've accessed it),
                // even if the step isn't marked as completed.
                // This prevents users from getting stuck on these screens.
                const isProblematicStep = currentStepId === 'timeline' || 
                                         currentStepId === 'liability-recommendation' || 
                                         currentStepId === 'claim-rationale';
                
                // Allow forward navigation if:
                // 1. Next step exists, AND
                // 2. Either the next step is accessible/completed, OR
                //    the user is on a problematic step (they've accessed it, so allow forward nav)
                const canGoNext = nextStep && (
                    isStepAccessible(nextStep.id) || 
                    isStepCompleted(nextStep.id) ||
                    isProblematicStep  // User is on timeline/liability/claim-rationale, allow forward navigation
                );
                nextButton.disabled = !canGoNext || currentStepIndex >= steps.length - 1;
            }
        }
    }
}

// File input change handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const expectedFileName = e.target.dataset.expectedFile;
        // Reset input immediately so same file can be selected again
        e.target.value = '';
        handleFileUpload(file, expectedFileName);
    }
});

// Bulk file input change handler
bulkFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        // Reset input immediately so same files can be selected again
        e.target.value = '';
        handleBulkUpload(files);
    }
});

function renderFileList() {
    fileList.innerHTML = '';
    
    // Check if any files are uploaded
    const hasUploadedFiles = Object.keys(uploadedFiles).length > 0;
    
    // Extract Facts button removed - only Next button is available
    
    // Upload button is now in the header and always visible
    
    // Collect all files for table display
    const allFiles = [];
    
    // First, collect all mapped files (files that match expected file types)
    expectedFiles.forEach((expectedFile) => {
        const isUploaded = uploadedFiles[expectedFile.name] !== undefined;
        const fileData = uploadedFiles[expectedFile.name];
        
        if (isUploaded) {
            allFiles.push({ 
                expectedFile, 
                fileData, 
                key: expectedFile.name,
                category: 'mapped',
                displayName: expectedFile.displayName
            });
        }
    });
    
    // Then, collect unmatched files
    Object.keys(uploadedFiles).forEach(key => {
        const fileData = uploadedFiles[key];
        const expectedFile = expectedFiles.find(f => f.name === key);
        
        if (!expectedFile && fileData) {
            const category = fileData.is_miscellaneous || (fileData.is_relevant && fileData.detected_source === 'unknown') 
                ? 'miscellaneous' 
                : 'other';
            allFiles.push({ 
                key, 
                fileData, 
                category,
                displayName: fileData.detected_source || 'Unknown'
            });
        }
    });
    
    // Show files in table format (if any)
    if (allFiles.length > 0) {
        const tableSection = document.createElement('div');
        tableSection.className = 'uploaded-files-section';
        tableSection.style.marginTop = '20px';
        
        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '10px';
        table.style.backgroundColor = '#fff';
        table.style.borderRadius = '4px';
        table.style.overflow = 'hidden';
        table.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        
        // Table header
        const thead = document.createElement('thead');
        thead.style.backgroundColor = '#f5f5f5';
        thead.innerHTML = `
            <tr>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #333; width: 40px;">Icon</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #333;">Filename</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #333;">Document Type</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #333;">Type</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #333;">Status</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Table body
        const tbody = document.createElement('tbody');
        
        allFiles.forEach(({ expectedFile, fileData, key, category, displayName }) => {
            const originalFilename = fileData.originalFilename || fileData.filename || key;
            const fileType = fileData.type || 'pdf';
            const detectedSource = fileData.detected_source || 'unknown';
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #eee';
            row.style.cursor = 'pointer';
            row.onmouseenter = () => {
                row.style.backgroundColor = '#f9f9f9';
            };
            row.onmouseleave = () => {
                row.style.backgroundColor = '#fff';
            };
            row.onclick = () => {
                viewUnmatchedFile(key);
            };
            
            // Determine status and category display
            let statusHtml = '<span style="color: #28a745; font-weight: 500;">✓ Uploaded</span>';
            let categoryDisplay = displayName || detectedSource;
            if (category === 'mapped') {
                categoryDisplay = expectedFile ? expectedFile.displayName : displayName;
            } else if (category === 'miscellaneous') {
                categoryDisplay = detectedSource;
            } else {
                categoryDisplay = detectedSource;
            }
            
            row.innerHTML = `
                <td style="padding: 12px; text-align: center;">${getFileIcon(fileType)}</td>
                <td style="padding: 12px; color: #333; font-weight: 500;">${escapeHtml(originalFilename)}</td>
                <td style="padding: 12px; color: #666;">${escapeHtml(categoryDisplay)}</td>
                <td style="padding: 12px; color: #666; text-transform: uppercase;">${fileType}</td>
                <td style="padding: 12px;">${statusHtml}</td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        tableSection.appendChild(table);
        fileList.appendChild(tableSection);
    }
}

function getFileIcon(type) {
    if (type === 'image') {
        return '🖼️';
    } else if (type === 'pdf') {
        return '📄';
    } else if (type === 'audio') {
        return '🎵';
    }
    return '📎';
}

function triggerFileUpload(expectedFileName, index) {
    // Set the expected file name on the input
    fileInput.dataset.expectedFile = expectedFileName;
    fileInput.click();
}

function handleFileUpload(file, expectedFileName) {
    // Validate file type matches expected file
    const expectedFile = expectedFiles.find(f => f.name === expectedFileName);
    if (!expectedFile) {
        showError('Invalid file selection.');
        return;
    }
    
    // Basic validation - check extension matches
    const fileExt = file.name.toLowerCase().split('.').pop();
    const expectedExt = expectedFileName.toLowerCase().split('.').pop();
    
    if (fileExt !== expectedExt) {
        showError(`Please upload a ${expectedExt.toUpperCase()} file for ${expectedFile.displayName}.`);
        return;
    }
    
    // Show loading state (keep global for file uploads)
    loading.style.display = 'block';
    error.style.display = 'none';
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    
    // Send to backend
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        loading.style.display = 'none';
        
        if (data.error) {
            showError(data.error);
        } else {
            // Store uploaded file data
            data.expectedFileName = expectedFileName;
            data.originalFilename = file.name;
            uploadedFiles[expectedFileName] = data;
            
            // Re-render file list to show uploaded status (this will also update button visibility)
            renderFileList();
            updateStepIndicators();
            updateProgress();
            updateNavigationButtons(); // Update next button state
            
            // Show success message briefly
            showSuccess(`${expectedFile.displayName} uploaded successfully!`);
            
            // Show loading state for evidence completeness immediately
            const evidenceLoading = document.getElementById('evidenceCompletenessLoading');
            const checksSummary = document.getElementById('checksSummarySection');
            if (evidenceLoading) {
                evidenceLoading.style.display = 'block';
            }
            if (checksSummary) {
                checksSummary.style.display = 'none';
            }
            
            // Run evidence completeness check after upload
            setTimeout(() => {
                checkEvidenceCompleteness();
            }, 500);
        }
    })
    .catch(err => {
        loading.style.display = 'none';
        showError(`Failed to upload ${file.name}. Please try again.`);
        console.error('Error:', err);
    });
}

function viewFile(expectedFileName) {
    const fileData = uploadedFiles[expectedFileName];
    if (!fileData) {
        showError('File not found.');
        return;
    }
    
    // Open file content in new tab
    openFileInNewTab(fileData);
}

function viewUnmatchedFile(fileKey) {
    const fileData = uploadedFiles[fileKey];
    if (!fileData) {
        showError('File not found.');
        return;
    }
    
    // Open file content in new tab
    openFileInNewTab(fileData);
}

function openFileInNewTab(data) {
    const filename = data.filename || data.originalFilename || 'Unknown';
    
    let htmlContent = '';
    
    if (data.type === 'image') {
        // Display image content
        htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(filename)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .metadata {
            margin-bottom: 30px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .metadata-item {
            margin-bottom: 10px;
        }
        .image-container {
            text-align: center;
            margin-top: 20px;
        }
        img {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapeHtml(filename)}</h1>
        <div class="metadata">
            <h2>Image Information</h2>
            <div class="metadata-item"><strong>Filename:</strong> ${escapeHtml(filename)}</div>
            <div class="metadata-item"><strong>Dimensions:</strong> ${data.width} × ${data.height} pixels</div>
            <div class="metadata-item"><strong>Format:</strong> ${data.format || 'Unknown'}</div>
            ${data.size ? `<div class="metadata-item"><strong>Size:</strong> ${formatFileSize(data.size)}</div>` : ''}
        </div>
        <div class="image-container">
            <img src="${data.data}" alt="${escapeHtml(filename)}">
        </div>
    </div>
</body>
</html>
        `;
    } else if (data.type === 'audio') {
        // Display audio transcription
        const transcription = data.transcription || (data.pages && data.pages.length > 0 ? data.pages[0].text : '');
        htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(filename)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .metadata {
            margin-bottom: 30px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .metadata-item {
            margin-bottom: 10px;
        }
        .transcription {
            margin-top: 20px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 4px;
            white-space: pre-wrap;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapeHtml(filename)}</h1>
        <div class="metadata">
            <h2>Audio Recording Information</h2>
            <div class="metadata-item"><strong>Filename:</strong> ${escapeHtml(filename)}</div>
            <div class="metadata-item"><strong>Type:</strong> Audio Recording</div>
            ${transcription ? `<div class="metadata-item"><strong>Transcription Status:</strong> Complete</div>` : '<div class="metadata-item"><strong>Transcription Status:</strong> Not available</div>'}
        </div>
        ${transcription && transcription.trim() ? `
        <div>
            <h2>Transcription</h2>
            <div class="transcription">${escapeHtml(transcription)}</div>
        </div>
        ` : '<div style="padding: 20px; text-align: center; color: #666;">No transcription available for this audio file.</div>'}
    </div>
</body>
</html>
        `;
    } else {
        // Display PDF content as continuous text
        const metadata = data.metadata || {};
        let contentHtml = '';
        if (!data.pages || data.pages.length === 0) {
            contentHtml = '<div style="padding: 20px; text-align: center; color: #666;">No content found in PDF.</div>';
        } else {
            // Combine all pages into one continuous text
            const allText = data.pages
                .map(page => page.text ? page.text.trim() : '')
                .filter(text => text.length > 0)
                .join('\n\n');
            
            if (allText) {
                contentHtml = `<div style="white-space: pre-wrap; line-height: 1.8; font-size: 14px; color: #333;">${escapeHtml(allText)}</div>`;
            } else {
                contentHtml = '<div style="padding: 20px; text-align: center; color: #666;">No text content found in PDF.</div>';
            }
        }
        
        htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(filename)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .metadata {
            margin-bottom: 30px;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .metadata-item {
            margin-bottom: 10px;
        }
        h2 {
            color: #333;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        .content {
            padding: 20px;
            background: #fff;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapeHtml(filename)}</h1>
        <div class="metadata">
            <h2>Document Information</h2>
            <div class="metadata-item"><strong>Filename:</strong> ${escapeHtml(filename)}</div>
            <div class="metadata-item"><strong>Pages:</strong> ${metadata.page_count || 0}</div>
            ${metadata.title ? `<div class="metadata-item"><strong>Title:</strong> ${escapeHtml(metadata.title)}</div>` : ''}
            ${metadata.author ? `<div class="metadata-item"><strong>Author:</strong> ${escapeHtml(metadata.author)}</div>` : ''}
            ${metadata.subject ? `<div class="metadata-item"><strong>Subject:</strong> ${escapeHtml(metadata.subject)}</div>` : ''}
        </div>
        <div class="content">
            ${contentHtml}
        </div>
    </div>
</body>
</html>
        `;
    }
    
    // Create a new window with the HTML content
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
    } else {
        showError('Please allow pop-ups to view files in a new tab.');
    }
}

function showFileList() {
    // Switch to Files tab
    switchTab('files');
    
    // Show file list, hide content view
    fileListContainer.style.display = 'block';
    fileContentView.style.display = 'none';
}

// Tab-specific loading indicator functions
function showTabLoading(tabName, message = 'Processing...') {
    const loadingId = tabName + 'Loading';
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
        const messageEl = loadingEl.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
        loadingEl.style.display = 'block';
        
        // For fact matrix, hide the table when showing loading
        if (tabName === 'factMatrix') {
            const factTable = document.getElementById('factTable');
            if (factTable) {
                factTable.style.display = 'none';
            }
        }
    }
}

function hideTabLoading(tabName) {
    const loadingId = tabName + 'Loading';
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
        loadingEl.style.display = 'none';
        
        // For fact matrix, show the table when hiding loading
        if (tabName === 'factMatrix') {
            const factTable = document.getElementById('factTable');
            if (factTable) {
                factTable.style.display = 'table';
            }
        }
    }
}

function checkStep1Completion() {
    // Step 1 is complete when facts are extracted and liability signals are generated
    // evidenceComplete is optional and doesn't block progression
    return step1Completion.factsExtracted && 
           step1Completion.liabilitySignals;
}

function updateStep2Access() {
    const timelineButton = document.getElementById('generateTimelineButton');
    if (timelineButton) {
        if (checkStep1Completion()) {
            timelineButton.disabled = false;
            timelineButton.style.opacity = '1';
            timelineButton.style.cursor = 'pointer';
        } else {
            timelineButton.disabled = true;
            timelineButton.style.opacity = '0.5';
            timelineButton.style.cursor = 'not-allowed';
        }
    }
}

function extractFacts() {
    // Check if there are any uploaded files
    const uploadedCount = Object.keys(uploadedFiles).length;
    if (uploadedCount === 0) {
        showError('Please upload at least one file before extracting facts.');
        return;
    }
    
    // Navigate to Fact Matrix tab immediately
    switchTab('fact-matrix');
    
    // Show loading state in Fact Matrix tab
    showTabLoading('factMatrix', 'Extracting facts...');
    error.style.display = 'none';
    
    // Prepare files data to send
    const filesData = Object.values(uploadedFiles);
    
    // Send to backend
    fetch('/extract-facts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: filesData })
    })
    .then(async response => {
        // Try to parse JSON response
        let data;
        try {
            const text = await response.text();
            if (text) {
                data = JSON.parse(text);
            } else {
                data = {};
            }
        } catch (parseError) {
            // If JSON parsing fails, create error object
            data = { error: `Server error: ${response.status} ${response.statusText}` };
        }
        
        if (!response.ok) {
            // Handle error responses
            const errorMessage = data.error || `Server error: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        return data;
    })
    .then(data => {
        hideTabLoading('factMatrix');
        
        if (data.error) {
            showError(data.error);
        } else if (data.facts) {
            // Store facts data - preserve acceptedVersions if they exist
            console.log('DEBUG: ========== Updating currentFactsData (first location) ==========');
            console.log('DEBUG: Existing currentFactsData:', currentFactsData);
            console.log('DEBUG: Existing acceptedVersions:', currentFactsData?.acceptedVersions);
            console.log('DEBUG: New data from server:', data);
            console.log('DEBUG: New data has acceptedVersions:', !!data.acceptedVersions);
            
            // Preserve acceptedVersions if they exist
            if (currentFactsData && currentFactsData.acceptedVersions) {
                console.log('DEBUG: Preserving existing acceptedVersions:', currentFactsData.acceptedVersions);
                data.acceptedVersions = currentFactsData.acceptedVersions;
            } else {
                console.log('DEBUG: No existing acceptedVersions to preserve');
            }
            
            currentFactsData = data;
            console.log('DEBUG: Updated currentFactsData:', currentFactsData);
            console.log('DEBUG: Updated acceptedVersions:', currentFactsData.acceptedVersions);
            console.log('DEBUG: ========== Update complete ==========');
            
            // Mark Step 1 fact extraction as complete
            step1Completion.factsExtracted = true;
            updateStep2Access();
            updateStepIndicators();
            updateProgress();
            // Display fact matrix
            displayFactMatrix(data);
        } else {
            showError('No facts received from server.');
        }
    })
    .catch(err => {
        hideTabLoading('factMatrix');
        // Display the actual error message if available
        const errorMessage = err.message || 'Failed to extract facts. Please try again.';
        showError(errorMessage);
        console.error('Extract facts error:', err);
        
        // Log additional details for debugging
        if (err.message) {
            console.error('Error details:', err.message);
        }
    });
}

function extractFactsAndSignals() {
    // Check if files are uploaded
    if (!uploadedFiles || Object.keys(uploadedFiles).length === 0) {
        showError('Please upload at least one file before extracting facts.');
        return;
    }
    
    // Navigate to Fact Matrix tab immediately
    switchTab('fact-matrix');
    
    // Show loading state in Fact Matrix tab
    showTabLoading('factMatrix', 'Extracting facts...');
    error.style.display = 'none';
    
    // Prepare files data to send
    const filesData = Object.values(uploadedFiles);
    
    // Send to backend
    fetch('/extract-facts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: filesData })
    })
    .then(async response => {
        // Try to parse JSON response
        let data;
        try {
            const text = await response.text();
            if (text) {
                data = JSON.parse(text);
            } else {
                data = {};
            }
        } catch (parseError) {
            // If JSON parsing fails, create error object
            data = { error: `Server error: ${response.status} ${response.statusText}` };
        }
        
        if (!response.ok) {
            // Handle error responses
            const errorMessage = data.error || `Server error: ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        return data;
    })
    .then(data => {
        if (data.error) {
            hideTabLoading('factMatrix');
            showError(data.error);
        } else if (data.facts) {
            // Store facts data - preserve acceptedVersions if they exist
            console.log('DEBUG: ========== Updating currentFactsData (second location) ==========');
            console.log('DEBUG: Existing currentFactsData:', currentFactsData);
            console.log('DEBUG: Existing acceptedVersions:', currentFactsData?.acceptedVersions);
            console.log('DEBUG: New data from server:', data);
            console.log('DEBUG: New data has acceptedVersions:', !!data.acceptedVersions);
            
            // Preserve acceptedVersions if they exist
            if (currentFactsData && currentFactsData.acceptedVersions) {
                console.log('DEBUG: Preserving existing acceptedVersions:', currentFactsData.acceptedVersions);
                data.acceptedVersions = currentFactsData.acceptedVersions;
            } else {
                console.log('DEBUG: No existing acceptedVersions to preserve');
            }
            
            currentFactsData = data;
            console.log('DEBUG: Updated currentFactsData:', currentFactsData);
            console.log('DEBUG: Updated acceptedVersions:', currentFactsData.acceptedVersions);
            console.log('DEBUG: ========== Update complete ==========');
            
            // Mark Step 1 fact extraction as complete
            step1Completion.factsExtracted = true;
            updateStep2Access();
            updateStepIndicators();
            updateProgress();
            // Hide loading indicator before displaying fact matrix
            hideTabLoading('factMatrix');
            // Display fact matrix first
            displayFactMatrix(data);
            
            // Don't analyze liability signals automatically - wait for conflicts to be resolved
        } else {
            hideTabLoading('factMatrix');
            showError('No facts received from server.');
        }
    })
    .catch(err => {
        hideTabLoading('factMatrix');
        // Display the actual error message if available
        const errorMessage = err.message || 'Failed to extract facts. Please try again.';
        showError(errorMessage);
        console.error('Extract facts error:', err);
        
        // Log additional details for debugging
        if (err.message) {
            console.error('Error details:', err.message);
        }
    });
}

function displayFactMatrix(factsData) {
    // Switch to Fact Matrix tab
    switchTab('fact-matrix');
    
    // Render facts table
    renderFactTable(factsData.facts);
    
    // Check if there are any conflicts
    const hasConflicts = factsData.conflicts && factsData.conflicts.length > 0;
    
    // If no conflicts, automatically analyze liability signals
    if (!hasConflicts && (!step1Completion.liabilitySignals || !currentLiabilitySignalsData)) {
        showSuccess('Generating liability signals...');
        setTimeout(() => {
            analyzeLiabilitySignals();
        }, 500);
    }
    
    // Scroll to top of tab
    document.getElementById('factMatrixTab').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFactTable(facts) {
    factTableBody.innerHTML = '';
    
    if (!facts || facts.length === 0) {
        factTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No facts extracted.</td></tr>';
        return;
    }
    
    facts.forEach((fact, index) => {
        const row = renderFactRow(fact, index);
        factTableBody.appendChild(row);
    });
}

function getFactConflictInfo(fact, factIndex) {
    if (!currentFactsData || !currentFactsData.conflicts || currentFactsData.conflicts.length === 0) {
        return null;
    }
    
    const factSource = fact.source || '';
    const factValue = fact.normalized_value || fact.extracted_fact || '';
    const factValueLower = factValue.toLowerCase().trim();
    
    // Check if this fact is part of any conflict
    for (let i = 0; i < currentFactsData.conflicts.length; i++) {
        const conflict = currentFactsData.conflicts[i];
        const conflictSources = conflict.sources || [];
        const conflictingValues = conflict.conflicting_values || [];
        
        // Check if fact's source is in conflict sources
        if (conflictSources.includes(factSource)) {
            // Check if fact's value matches any conflicting value
            for (const confValue of conflictingValues) {
                const confValueLower = confValue.toLowerCase().trim();
                // Fuzzy match: check if values are similar
                if (factValueLower === confValueLower || 
                    factValueLower.includes(confValueLower) || 
                    confValueLower.includes(factValueLower)) {
                    return { conflictIndex: i, conflict: conflict };
                }
            }
            
            // Also check value_details for more precise matching
            const valueDetails = conflict.value_details || [];
            for (const valueDetail of valueDetails) {
                const detailSources = valueDetail.sources || [];
                const detailValue = valueDetail.value || '';
                const detailValueLower = detailValue.toLowerCase().trim();
                
                if (detailSources.includes(factSource)) {
                    if (factValueLower === detailValueLower || 
                        factValueLower.includes(detailValueLower) || 
                        detailValueLower.includes(factValueLower)) {
                        return { conflictIndex: i, conflict: conflict };
                    }
                }
            }
        }
    }
    
    return null;
}

function getFactSignalInfo(fact, factIndex) {
    if (!currentLiabilitySignalsData || !currentLiabilitySignalsData.signals || currentLiabilitySignalsData.signals.length === 0) {
        return null;
    }
    
    // Try to match fact with signal by related facts or evidence text
    const factText = (fact.extracted_fact || '').toLowerCase();
    const sourceText = (fact.source_text || '').toLowerCase();
    
    for (const signal of currentLiabilitySignalsData.signals) {
        const evidenceText = (signal.evidence_text || '').toLowerCase();
        const relatedFacts = signal.related_facts || [];
        
        // Check if fact text appears in evidence or related facts
        if (evidenceText.includes(factText) || sourceText.includes(evidenceText.substring(0, 50))) {
            return signal;
        }
        
        // Check related facts
        for (const relatedFact of relatedFacts) {
            const relatedText = typeof relatedFact === 'string' ? relatedFact.toLowerCase() : JSON.stringify(relatedFact).toLowerCase();
            if (relatedText.includes(factText) || factText.includes(relatedText.substring(0, 50))) {
                return signal;
            }
        }
    }
    
    return null;
}

function renderFactRow(fact, index) {
    const row = document.createElement('tr');
    row.dataset.index = index;
    row.dataset.factNumber = index + 1;
    row.dataset.category = fact.category || '';
    row.dataset.source = fact.source || '';
    row.dataset.factText = (fact.extracted_fact || '').toLowerCase();
    
    // Fact number (first column)
    const factNumberCell = document.createElement('td');
    factNumberCell.textContent = index + 1;
    factNumberCell.style.fontWeight = '600';
    factNumberCell.style.textAlign = 'center';
    
    // Source text (truncated with expand)
    const sourceTextCell = document.createElement('td');
    const sourceText = fact.source_text || '';
    const truncatedText = sourceText.length > 100 ? sourceText.substring(0, 100) + '...' : sourceText;
    sourceTextCell.innerHTML = `
        <div class="source-text-container">
            <span class="source-text-short">${escapeHtml(truncatedText)}</span>
            ${sourceText.length > 100 ? `<button class="expand-text-btn" onclick="toggleSourceText(${index})">Show more</button>` : ''}
            <span class="source-text-full" style="display: none;">${escapeHtml(sourceText)}</span>
        </div>
    `;
    
    // Extracted fact
    const extractedFactCell = document.createElement('td');
    const extractedFactText = fact.extracted_fact || '';
    extractedFactCell.textContent = extractedFactText;
    
    // Category (with badge)
    const categoryCell = document.createElement('td');
    const category = fact.category || 'unknown';
    categoryCell.innerHTML = `<span class="category-badge category-${category}">${category}</span>`;
    
    // Source (with badge)
    const sourceCell = document.createElement('td');
    const source = fact.source || 'unknown';
    sourceCell.innerHTML = `<span class="source-badge source-${source}">${source.replace('_', ' ')}</span>`;
    
    // Conflict column (check if fact is part of any conflict)
    const conflictCell = document.createElement('td');
    const conflictInfo = getFactConflictInfo(fact, index);
    if (conflictInfo) {
        // Check if this conflict is resolved
        // Use String() for consistent key type matching
        const isResolved = currentFactsData && 
                          currentFactsData.acceptedVersions && 
                          currentFactsData.acceptedVersions[String(conflictInfo.conflictIndex)];
        
        const conflictBadge = document.createElement('span');
        if (isResolved) {
            conflictBadge.className = 'conflict-badge resolved';
            conflictBadge.textContent = 'Resolved';
            conflictBadge.style.background = '#4CAF50';
            conflictBadge.style.color = 'white';
            conflictBadge.style.cursor = 'pointer';
            conflictBadge.onclick = (e) => {
                e.stopPropagation();
                showResolvedConflictDetails(conflictInfo.conflictIndex, fact, index);
            };
        } else {
            conflictBadge.className = 'conflict-badge has-conflict';
            conflictBadge.textContent = 'Conflict';
            conflictBadge.onclick = (e) => {
                e.stopPropagation();
                openConflictModal(conflictInfo.conflictIndex, fact, index);
            };
        }
        conflictCell.appendChild(conflictBadge);
    } else {
        const noConflictBadge = document.createElement('span');
        noConflictBadge.className = 'conflict-badge no-conflict';
        noConflictBadge.textContent = '—';
        conflictCell.appendChild(noConflictBadge);
    }
    
    // Signal Type column (from liability signals)
    const signalTypeCell = document.createElement('td');
    signalTypeCell.className = 'liability-signal-type-cell';
    signalTypeCell.dataset.factIndex = index;
    const signalInfo = getFactSignalInfo(fact, index);
    if (signalInfo && signalInfo.signal_type) {
        const signalType = signalInfo.signal_type || 'unknown';
        signalTypeCell.innerHTML = `<span class="signal-type-badge signal-type-${signalType.replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(signalType)}</span>`;
    } else {
        signalTypeCell.textContent = '—';
    }
    
    // Impact on Liability column
    const impactCell = document.createElement('td');
    impactCell.className = 'liability-impact-cell';
    impactCell.dataset.factIndex = index;
    if (signalInfo && signalInfo.impact_on_liability) {
        impactCell.textContent = signalInfo.impact_on_liability;
    } else {
        impactCell.textContent = '—';
    }
    
    // Severity column
    const severityCell = document.createElement('td');
    severityCell.className = 'liability-severity-cell';
    severityCell.dataset.factIndex = index;
    if (signalInfo && signalInfo.severity_score !== undefined) {
        const severity = signalInfo.severity_score || 0;
        const severityPercent = Math.round(severity * 100);
        severityCell.innerHTML = `
            <div class="severity-container">
                <div class="severity-bar">
                    <div class="severity-fill" style="width: ${severityPercent}%"></div>
                </div>
                <span class="severity-text">${severityPercent}%</span>
            </div>
        `;
    } else {
        severityCell.textContent = '—';
    }
    
    // Add resolved class to row if fact is resolved
    if (fact.resolved) {
        row.classList.add('resolved-fact');
        row.style.backgroundColor = '#f0f9f0';
    }
    
    row.appendChild(factNumberCell);
    row.appendChild(sourceTextCell);
    row.appendChild(extractedFactCell);
    row.appendChild(categoryCell);
    row.appendChild(sourceCell);
    row.appendChild(conflictCell);
    row.appendChild(signalTypeCell);
    row.appendChild(impactCell);
    row.appendChild(severityCell);
    
    return row;
}

function getSourceIcon(source) {
    // Return empty string for minimalist design
    return '';
}

function toggleSourceText(index) {
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (!row) return;
    
    const shortText = row.querySelector('.source-text-short');
    const fullText = row.querySelector('.source-text-full');
    const button = row.querySelector('.expand-text-btn');
    
    if (fullText.style.display === 'none') {
        shortText.style.display = 'none';
        fullText.style.display = 'inline';
        button.textContent = 'Show less';
    } else {
        shortText.style.display = 'inline';
        fullText.style.display = 'none';
        button.textContent = 'Show more';
    }
}

function filterFacts() {
    if (!currentFactsData || !currentFactsData.facts) return;
    
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sourceFilter = document.getElementById('sourceFilter').value;
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
    const sortBy = document.getElementById('sortBy').value;
    
    let filteredFacts = [...currentFactsData.facts];
    
    // Apply filters
    if (categoryFilter) {
        filteredFacts = filteredFacts.filter(f => f.category === categoryFilter);
    }
    
    if (sourceFilter) {
        filteredFacts = filteredFacts.filter(f => f.source === sourceFilter);
    }
    
    if (searchFilter) {
        filteredFacts = filteredFacts.filter(f => 
            (f.extracted_fact || '').toLowerCase().includes(searchFilter) ||
            (f.source_text || '').toLowerCase().includes(searchFilter) ||
            (f.normalized_value || '').toLowerCase().includes(searchFilter)
        );
    }
    
    // Apply sorting
    if (sortBy === 'confidence') {
        filteredFacts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } else if (sortBy === 'confidence-asc') {
        filteredFacts.sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
    } else if (sortBy === 'category') {
        filteredFacts.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    } else if (sortBy === 'source') {
        filteredFacts.sort((a, b) => (a.source || '').localeCompare(b.source || ''));
    }
    
    // Re-render table
    renderFactTable(filteredFacts);
}

function displayAcceptedDecisions() {
    if (!currentFactsData || !currentFactsData.acceptedVersions || !currentFactsData.conflicts) {
        return;
    }
    
    const tableBody = document.getElementById('acceptedDecisionsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    Object.keys(currentFactsData.acceptedVersions).forEach(conflictIndex => {
        const conflict = currentFactsData.conflicts[parseInt(conflictIndex)];
        const accepted = currentFactsData.acceptedVersions[conflictIndex];
        
        if (conflict && accepted) {
            const row = document.createElement('tr');
            row.className = 'accepted-decision-row';
            
            // Conflict Description
            const conflictCell = document.createElement('td');
            conflictCell.textContent = conflict.fact_description || 'Conflict';
            
            // Accepted Value
            const acceptedCell = document.createElement('td');
            acceptedCell.textContent = accepted.value || '';
            
            // Resolved status
            const resolvedCell = document.createElement('td');
            const resolvedBadge = document.createElement('span');
            resolvedBadge.className = 'resolved-badge';
            resolvedBadge.textContent = 'Resolved';
            resolvedBadge.style.background = '#4CAF50';
            resolvedBadge.style.color = 'white';
            resolvedBadge.style.padding = '4px 12px';
            resolvedBadge.style.borderRadius = '12px';
            resolvedBadge.style.fontSize = '0.85em';
            resolvedBadge.style.fontWeight = '600';
            resolvedBadge.title = `Resolved: ${new Date(accepted.timestamp).toLocaleString()}`;
            resolvedCell.appendChild(resolvedBadge);
            
            row.appendChild(conflictCell);
            row.appendChild(acceptedCell);
            row.appendChild(resolvedCell);
            
            tableBody.appendChild(row);
        }
    });
}

function displayConflicts(conflicts) {
    console.log('DEBUG: ========== displayConflicts called ==========');
    console.log('DEBUG: conflicts parameter:', conflicts);
    console.log('DEBUG: conflicts length:', conflicts?.length);
    console.log('DEBUG: currentFactsData exists:', !!currentFactsData);
    console.log('DEBUG: currentFactsData.acceptedVersions:', currentFactsData?.acceptedVersions);
    
    if (!conflicts || conflicts.length === 0) {
        console.log('DEBUG: No conflicts to display');
        if (conflictsPanel) {
            conflictsPanel.style.display = 'none';
        }
        return;
    }
    
    console.log('DEBUG: Displaying', conflicts.length, 'conflicts');
    
    if (conflictsPanel) {
        conflictsPanel.style.display = 'block';
    }
    if (conflictsContent) {
        conflictsContent.innerHTML = '';
    }
    
    conflicts.forEach((conflict, index) => {
        console.log(`DEBUG: Processing conflict ${index}:`, conflict);
        const acceptedVersion = currentFactsData?.acceptedVersions?.[String(index)] || currentFactsData?.acceptedVersions?.[index];
        console.log(`DEBUG: Conflict ${index} accepted version:`, acceptedVersion);
        const conflictDiv = document.createElement('div');
        conflictDiv.className = 'conflict-item';
        conflictDiv.setAttribute('data-conflict-index', index);
        
        const recommendedVersion = conflict.recommended_version || '';
        const evidence = conflict.evidence || '';
        const valueDetails = conflict.value_details || [];
        
        // Build value variants display with snippets
        let valueVariantsHtml = '';
        if (valueDetails.length > 0) {
            valueVariantsHtml = valueDetails.map((detail, detailIndex) => {
                const value = detail.value || '';
                const sources = detail.sources || [];
                const snippets = detail.source_snippets || [];
                const isRecommended = value === recommendedVersion;
                
                        return `
                    <div class="value-variant ${isRecommended ? 'recommended' : ''}" data-value="${escapeHtml(value)}" data-conflict-index="${index}" data-variant-index="${detailIndex}">
                        <div class="variant-header">
                            <strong>${escapeHtml(value)}</strong>
                            ${isRecommended ? '<span class="recommended-badge">Recommended</span>' : ''}
                        </div>
                        <div class="variant-sources">
                            <strong>Sources:</strong> ${sources.map(s => `<span class="source-badge source-${s}">${s.replace('_', ' ')}</span>`).join(', ')}
                        </div>
                        ${snippets.length > 0 ? `
                            <div class="variant-snippets">
                                <strong>Source Snippets:</strong>
                                <div class="snippets-list">
                                    ${snippets.map(snippet => `<div class="snippet-item">${escapeHtml(snippet)}</div>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <button class="accept-button" onclick="acceptConflictVersion(${index}, ${detailIndex}, '${escapeHtml(value).replace(/'/g, "\\'")}')">
                            Accept This Version
                        </button>
                    </div>
                `;
            }).join('');
        } else {
            // Fallback to old format if value_details not available
            valueVariantsHtml = `
                <div class="conflict-values-old">
                    <strong>Conflicting Values:</strong>
                    <ul>
                        ${conflict.conflicting_values.map((v, vIndex) => `
                            <li>
                                ${escapeHtml(v)}
                                ${v === recommendedVersion ? ' <span class="recommended-badge">Recommended</span>' : ''}
                                <button class="accept-button-small" onclick="acceptConflictVersion(${index}, ${vIndex}, '${escapeHtml(v).replace(/'/g, "\\'")}')">
                                    Accept
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        conflictDiv.innerHTML = `
            <div class="conflict-header">
                <strong>${escapeHtml(conflict.fact_description)}</strong>
                ${conflict.severity ? `<span class="severity-badge severity-${conflict.severity}">${conflict.severity.toUpperCase()}</span>` : ''}
            </div>
            <div class="conflict-details">
                <div class="conflict-sources">
                    <strong>Sources:</strong> ${conflict.sources.map(s => `<span class="source-badge source-${s}">${s.replace('_', ' ')}</span>`).join(', ')}
                </div>
                ${recommendedVersion && evidence ? `
                    <div class="conflict-recommendation">
                        <div class="recommendation-header">
                            <strong>AI Recommendation:</strong>
                        </div>
                        <div class="recommended-value">
                            <strong>Recommended Version:</strong> <span class="highlight">${escapeHtml(recommendedVersion)}</span>
                        </div>
                        <div class="recommendation-evidence">
                            <strong>Evidence:</strong>
                            <p>${escapeHtml(evidence)}</p>
                        </div>
                    </div>
                ` : ''}
                <div class="conflict-variants">
                    <strong>Value Variants:</strong>
                    <div class="variants-container">
                        ${valueVariantsHtml}
                    </div>
                </div>
                ${conflict.explanation ? `
                    <div class="conflict-explanation">
                        <strong>Explanation:</strong> ${escapeHtml(conflict.explanation)}
                    </div>
                ` : ''}
            </div>
        `;
        conflictsContent.appendChild(conflictDiv);
    });
}

function acceptConflictVersion(conflictIndex, variantIndex, acceptedValue) {
    console.log('DEBUG: ========== acceptConflictVersion called ==========');
    console.log('DEBUG: Parameters:', { 
        conflictIndex, 
        conflictIndexType: typeof conflictIndex,
        variantIndex, 
        variantIndexType: typeof variantIndex,
        acceptedValue 
    });
    
    if (!currentFactsData || !currentFactsData.conflicts) {
        console.log('ERROR: No conflicts data available');
        console.log('ERROR: currentFactsData:', currentFactsData);
        showError('No conflicts data available.');
        return;
    }
    
    console.log('DEBUG: currentFactsData.conflicts length:', currentFactsData.conflicts.length);
    console.log('DEBUG: conflictIndex:', conflictIndex, 'type:', typeof conflictIndex);
    console.log('DEBUG: Checking if conflict exists at index:', conflictIndex);
    
    const conflict = currentFactsData.conflicts[conflictIndex];
    if (!conflict) {
        console.log('ERROR: Conflict not found at index', conflictIndex);
        console.log('ERROR: Available conflict indices: 0 to', currentFactsData.conflicts.length - 1);
        showError('Conflict not found.');
        return;
    }
    
    console.log('DEBUG: Conflict found:', conflict);
    
    // Store accepted version
    // Convert conflictIndex to string for consistent key type (matching checkIfAllConflictsResolved)
    console.log('DEBUG: acceptedVersions before:', currentFactsData.acceptedVersions);
    console.log('DEBUG: acceptedVersions exists:', !!currentFactsData.acceptedVersions);
    
    if (!currentFactsData.acceptedVersions) {
        console.log('DEBUG: Initializing acceptedVersions object');
        currentFactsData.acceptedVersions = {};
    }
    
    const key = String(conflictIndex);
    const keyNum = Number(conflictIndex);
    console.log('DEBUG: Storing with key:', key, 'type:', typeof key);
    console.log('DEBUG: Also trying numeric key:', keyNum, 'type:', typeof keyNum);
    
    const acceptedVersionData = {
        value: acceptedValue,
        variantIndex: variantIndex,
        timestamp: new Date().toISOString()
    };
    
    currentFactsData.acceptedVersions[key] = acceptedVersionData;
    console.log('DEBUG: Stored accepted version with string key:', { 
        key, 
        keyType: typeof key,
        storedValue: currentFactsData.acceptedVersions[key] 
    });
    
    // Also store with numeric key for safety
    currentFactsData.acceptedVersions[keyNum] = acceptedVersionData;
    console.log('DEBUG: Also stored with numeric key:', { 
        keyNum, 
        keyNumType: typeof keyNum,
        storedValue: currentFactsData.acceptedVersions[keyNum] 
    });
    
    console.log('DEBUG: All acceptedVersions after store:', currentFactsData.acceptedVersions);
    console.log('DEBUG: acceptedVersions JSON:', JSON.stringify(currentFactsData.acceptedVersions, null, 2));
    console.log('DEBUG: acceptedVersions keys:', Object.keys(currentFactsData.acceptedVersions));
    console.log('DEBUG: acceptedVersions entries:', Object.entries(currentFactsData.acceptedVersions));
    
    // Verify it was stored correctly - comprehensive validation
    console.log('DEBUG: ========== VALIDATION: Verifying storage ==========');
    const stringKeyExists = key in currentFactsData.acceptedVersions;
    const numericKeyExists = keyNum in currentFactsData.acceptedVersions;
    const stringKeyValue = currentFactsData.acceptedVersions[key];
    const numericKeyValue = currentFactsData.acceptedVersions[keyNum];
    const stringKeyValid = stringKeyExists && stringKeyValue && stringKeyValue.value === acceptedValue;
    const numericKeyValid = numericKeyExists && numericKeyValue && numericKeyValue.value === acceptedValue;
    
    console.log('DEBUG: Verification - checking stored value:');
    console.log('  - acceptedVersions["' + key + '"] exists:', stringKeyExists);
    console.log('  - acceptedVersions["' + key + '"] value:', stringKeyValue);
    console.log('  - acceptedVersions[' + keyNum + '] exists:', numericKeyExists);
    console.log('  - acceptedVersions[' + keyNum + '] value:', numericKeyValue);
    console.log('  - String key valid:', stringKeyValid);
    console.log('  - Numeric key valid:', numericKeyValid);
    console.log('  - "' + key + '" in acceptedVersions:', stringKeyExists);
    console.log('  - ' + keyNum + ' in acceptedVersions:', numericKeyExists);
    
    // If validation fails, try to fix it
    if (!stringKeyValid && !numericKeyValid) {
        console.error('ERROR: [acceptConflictVersion] Storage validation FAILED - attempting to fix...');
        // Force store again with both keys
        currentFactsData.acceptedVersions[key] = { ...acceptedVersionData };
        currentFactsData.acceptedVersions[keyNum] = { ...acceptedVersionData };
        console.log('DEBUG: [FIX] Re-stored with both keys after validation failure');
        
        // Verify again
        const recheckString = currentFactsData.acceptedVersions[key] && currentFactsData.acceptedVersions[key].value === acceptedValue;
        const recheckNumeric = currentFactsData.acceptedVersions[keyNum] && currentFactsData.acceptedVersions[keyNum].value === acceptedValue;
        if (recheckString || recheckNumeric) {
            console.log('DEBUG: [FIX] Validation passed after re-storage');
        } else {
            console.error('ERROR: [acceptConflictVersion] Storage validation STILL FAILED after fix attempt');
            showError('Warning: Failed to store accepted version. Please try again.');
        }
    } else {
        console.log('DEBUG: [VALIDATION] Storage verification PASSED');
    }
    
    // Additional check: verify the key can be retrieved using the same method checkIfAllConflictsResolved uses
    const testKeyStr = String(conflictIndex);
    const testKeyNum = Number(conflictIndex);
    const canRetrieveByString = currentFactsData.acceptedVersions[testKeyStr] && currentFactsData.acceptedVersions[testKeyStr].value === acceptedValue;
    const canRetrieveByNumber = currentFactsData.acceptedVersions[testKeyNum] && currentFactsData.acceptedVersions[testKeyNum].value === acceptedValue;
    console.log('DEBUG: [RETRIEVAL TEST] Can retrieve by string key (' + testKeyStr + '):', canRetrieveByString);
    console.log('DEBUG: [RETRIEVAL TEST] Can retrieve by numeric key (' + testKeyNum + '):', canRetrieveByNumber);
    
    if (!canRetrieveByString && !canRetrieveByNumber) {
        console.error('ERROR: [acceptConflictVersion] Retrieval test FAILED - key may not be accessible by checkIfAllConflictsResolved');
    } else {
        console.log('DEBUG: [RETRIEVAL TEST] Retrieval test PASSED');
    }
    
    console.log('DEBUG: ========== acceptConflictVersion storage complete ==========');
    
    // Update fact matrix with accepted value
    if (currentFactsData.facts && conflict.sources && conflict.conflicting_values) {
        const conflictSources = conflict.sources;
        const conflictingValues = conflict.conflicting_values;
        
        // Find the value details for the accepted value
        const valueDetails = conflict.value_details || [];
        const acceptedValueDetail = valueDetails.find(detail => detail.value === acceptedValue);
        const acceptedSources = acceptedValueDetail ? acceptedValueDetail.sources : [];
        const acceptedSnippets = acceptedValueDetail ? acceptedValueDetail.source_snippets || [] : [];
        
        // Find facts that need to be updated (facts that are part of conflict but not in accepted sources)
        const factsToUpdate = [];
        
        currentFactsData.facts.forEach((fact, factIndex) => {
            const factSource = fact.source || '';
            const factValue = fact.normalized_value || fact.extracted_fact || '';
            const factSourceText = fact.source_text || '';
            
            // Check if this fact is part of the conflict sources
            const isInConflictSources = conflictSources.includes(factSource);
            
            if (isInConflictSources) {
                // Check if fact matches any conflicting value
                const matchesConflictingValue = conflictingValues.some(confValue => {
                    const confValueLower = confValue.toLowerCase().trim();
                    const factValueLower = factValue.toLowerCase().trim();
                    // Check if the fact value matches any conflicting value (fuzzy match)
                    return factValueLower === confValueLower || 
                           factValueLower.includes(confValueLower) || 
                           confValueLower.includes(factValueLower);
                });
                
                // Check if fact's source text matches any source snippets from the conflict
                const matchesSourceSnippet = acceptedSnippets.length > 0 ? 
                    acceptedSnippets.some(snippet => {
                        const snippetLower = snippet.toLowerCase();
                        const factSourceTextLower = factSourceText.toLowerCase();
                        // Check if snippet appears in fact's source text (at least 20 chars overlap)
                        return snippetLower.length > 20 && factSourceTextLower.includes(snippetLower.substring(0, Math.min(50, snippetLower.length)));
                    }) : false;
                
                // Determine if this fact should be updated
                // Update if:
                // 1. Fact is in conflict sources AND
                // 2. (Fact doesn't match accepted value OR fact is not in accepted sources) AND
                // 3. (Fact matches a conflicting value OR fact's source text matches conflict snippets)
                const shouldUpdate = isInConflictSources && 
                    (factValue.toLowerCase().trim() !== acceptedValue.toLowerCase().trim()) &&
                    (!acceptedSources.includes(factSource) || matchesSourceSnippet) &&
                    (matchesConflictingValue || matchesSourceSnippet);
                
                if (shouldUpdate) {
                    factsToUpdate.push({ fact, factIndex });
                }
            }
        });
        
        // Update the facts
        factsToUpdate.forEach(({ fact }) => {
            // Update the normalized_value to the accepted value
            fact.normalized_value = acceptedValue;
            
            // Update extracted_fact if it contains conflicting values
            if (fact.extracted_fact) {
                const extractedFactLower = fact.extracted_fact.toLowerCase();
                const conflictingValuesLower = conflictingValues.map(v => v.toLowerCase().trim());
                const factContainsConflictingValue = conflictingValuesLower.some(cv => 
                    extractedFactLower.includes(cv) || cv.includes(extractedFactLower)
                );
                
                if (factContainsConflictingValue) {
                    // Replace conflicting value with accepted value in extracted_fact
                    let updatedExtractedFact = fact.extracted_fact;
                    conflictingValues.forEach(confValue => {
                        const regex = new RegExp(confValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        updatedExtractedFact = updatedExtractedFact.replace(regex, acceptedValue);
                    });
                    fact.extracted_fact = updatedExtractedFact;
                }
            }
            
            // Mark fact as resolved/updated
            fact.resolved = true;
            fact.resolved_value = acceptedValue;
            fact.resolved_timestamp = new Date().toISOString();
        });
        
        // Re-render the fact table to reflect updates (always re-render to update conflict badges)
        renderFactTable(currentFactsData.facts);
    }
    
    // Update UI to show accepted version
    const conflictDiv = document.querySelector(`[data-conflict-index="${conflictIndex}"]`);
    if (conflictDiv) {
        // Remove previous accepted indicators
        conflictDiv.querySelectorAll('.accepted-indicator').forEach(el => el.remove());
        
        // Add accepted indicator
        const variantDiv = conflictDiv.querySelector(`[data-variant-index="${variantIndex}"]`);
        if (variantDiv) {
            const acceptedIndicator = document.createElement('div');
            acceptedIndicator.className = 'accepted-indicator';
            acceptedIndicator.innerHTML = '<span class="accepted-badge">Accepted</span>';
            variantDiv.appendChild(acceptedIndicator);
        }
        
        // Disable accept buttons for this conflict
        conflictDiv.querySelectorAll('.accept-button, .accept-button-small').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });
    }
    
    showSuccess(`Accepted version: "${acceptedValue}" - Fact matrix updated.`);
    
    // Check if all conflicts are resolved
    console.log('DEBUG: Checking if all conflicts resolved after accepting version');
    console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Checking conflict resolution status...');
    const allResolved = checkIfAllConflictsResolved();
    console.log('DEBUG: All conflicts resolved after accept:', allResolved);
    console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] All conflicts resolved:', allResolved);
    
    if (allResolved) {
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] ========== ALL CONFLICTS RESOLVED ==========');
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Timestamp:', new Date().toISOString());
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Current facts count:', currentFactsData?.facts?.length || 0);
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Conflicts count:', currentFactsData?.conflicts?.length || 0);
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Accepted versions count:', currentFactsData?.acceptedVersions ? Object.keys(currentFactsData.acceptedVersions).length : 0);
        
        // Switch to resolved layout
        displayFactMatrix(currentFactsData);
        
        // Update step access in case Step 1 is now complete
        updateStep2Access();
        updateStepIndicators();
        updateProgress();
        
        // Automatically trigger liability signal analysis immediately
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Auto-triggering liability signal analysis...');
        console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Current liability signals state:', {
            step1Completion_liabilitySignals: step1Completion.liabilitySignals,
            currentLiabilitySignalsData_exists: !!currentLiabilitySignalsData,
            currentLiabilitySignalsData_signals_count: currentLiabilitySignalsData?.signals?.length || 0
        });
        
        // Call analyzeLiabilitySignals immediately
        setTimeout(() => {
            console.log('LIABILITY_SIGNAL_LOG: [acceptVersion] Executing analyzeLiabilitySignals() after timeout...');
            analyzeLiabilitySignals();
        }, 100);
        
        // Show popup when all conflicts are resolved
        showAllConflictsResolvedPopup();
    }
    
    // Close modal
    closeConflictModal();
}

function openConflictModal(conflictIndex, fact, factIndex) {
    console.log('DEBUG: ========== openConflictModal called ==========');
    console.log('DEBUG: Parameters:', { conflictIndex, conflictIndexType: typeof conflictIndex, factIndex });
    console.log('DEBUG: currentFactsData exists:', !!currentFactsData);
    console.log('DEBUG: currentFactsData.conflicts exists:', !!currentFactsData?.conflicts);
    console.log('DEBUG: currentFactsData.conflicts length:', currentFactsData?.conflicts?.length);
    console.log('DEBUG: currentFactsData.acceptedVersions:', currentFactsData?.acceptedVersions);
    
    if (!currentFactsData || !currentFactsData.conflicts || !currentFactsData.conflicts[conflictIndex]) {
        console.log('ERROR: Conflict not found at index', conflictIndex);
        showError('Conflict not found.');
        return;
    }
    
    const conflict = currentFactsData.conflicts[conflictIndex];
    console.log('DEBUG: Conflict found:', conflict);
    console.log('DEBUG: Conflict index:', conflictIndex);
    
    // Check if this conflict has an accepted version
    const acceptedVersionStr = currentFactsData.acceptedVersions?.[String(conflictIndex)];
    const acceptedVersionNum = currentFactsData.acceptedVersions?.[Number(conflictIndex)];
    const acceptedVersion = acceptedVersionStr || acceptedVersionNum;
    console.log('DEBUG: Accepted version for conflict', conflictIndex, ':', acceptedVersion);
    console.log('DEBUG: Accepted version (string key):', acceptedVersionStr);
    console.log('DEBUG: Accepted version (numeric key):', acceptedVersionNum);
    const modal = document.getElementById('conflictModal');
    const modalBody = document.getElementById('conflictModalBody');
    
    if (!modal || !modalBody) {
        showError('Modal elements not found.');
        return;
    }
    
    // Build variant HTML
    const valueDetails = conflict.value_details || [];
    const recommendedVersion = conflict.recommended_version || '';
    const evidence = conflict.evidence || '';
    
    let variantsHtml = '';
    if (valueDetails.length > 0) {
        variantsHtml = valueDetails.map((valueDetail, variantIndex) => {
            const value = valueDetail.value || '';
            const sources = valueDetail.sources || [];
            const snippets = valueDetail.source_snippets || [];
            const isRecommended = value === recommendedVersion;
            // Use String() for consistent key type matching
            const isAccepted = currentFactsData.acceptedVersions && 
                              currentFactsData.acceptedVersions[String(conflictIndex)] &&
                              currentFactsData.acceptedVersions[String(conflictIndex)].value === value;
            
            return `
                <div class="conflict-variant-item ${isRecommended ? 'recommended' : ''} ${isAccepted ? 'selected' : ''}" 
                     data-variant-index="${variantIndex}"
                     onclick="selectConflictVariant(${conflictIndex}, ${variantIndex}, '${escapeHtml(value).replace(/'/g, "\\'")}')">
                    <div class="conflict-variant-header">
                        <span class="conflict-variant-value">${escapeHtml(value)}</span>
                        <div class="conflict-variant-badges">
                            ${isRecommended ? '<span class="recommended-badge">Recommended</span>' : ''}
                            ${isAccepted ? '<span class="accepted-badge">Accepted</span>' : ''}
                        </div>
                    </div>
                    <div class="conflict-variant-sources">
                        <strong>Sources:</strong> ${sources.map(s => `<span class="source-badge source-${s}">${s.replace('_', ' ')}</span>`).join(', ')}
                    </div>
                    ${snippets.length > 0 ? `
                        <div class="conflict-variant-snippets">
                            ${snippets.map(snippet => `<div class="conflict-snippet">${escapeHtml(snippet)}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } else {
        // Fallback to conflicting_values if value_details not available
        variantsHtml = (conflict.conflicting_values || []).map((value, variantIndex) => {
            const isRecommended = value === recommendedVersion;
            return `
                <div class="conflict-variant-item ${isRecommended ? 'recommended' : ''}" 
                     data-variant-index="${variantIndex}"
                     onclick="selectConflictVariant(${conflictIndex}, ${variantIndex}, '${escapeHtml(value).replace(/'/g, "\\'")}')">
                    <div class="conflict-variant-header">
                        <span class="conflict-variant-value">${escapeHtml(value)}</span>
                        ${isRecommended ? '<span class="recommended-badge">Recommended</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Build modal content
    modalBody.innerHTML = `
        <div>
            <h4 style="margin-top: 0;">${escapeHtml(conflict.fact_description || 'Conflict Resolution')}</h4>
            ${conflict.severity ? `<p><strong>Severity:</strong> <span class="severity-badge severity-${conflict.severity}">${conflict.severity.toUpperCase()}</span></p>` : ''}
            ${conflict.explanation ? `<p><strong>Explanation:</strong> ${escapeHtml(conflict.explanation)}</p>` : ''}
            ${recommendedVersion && evidence ? `
                <div class="conflict-recommendation" style="margin: 15px 0; padding: 15px; background: #e7f3ff; border-radius: 6px; border-left: 4px solid #2196F3;">
                    <div class="recommendation-header">
                        <strong>AI Recommendation:</strong>
                    </div>
                    <div class="recommended-value">
                        <strong>Recommended Version:</strong> <span class="highlight">${escapeHtml(recommendedVersion)}</span>
                    </div>
                    <div class="recommendation-evidence">
                        <strong>Evidence:</strong>
                        <p>${escapeHtml(evidence)}</p>
                    </div>
                </div>
            ` : ''}
            <div style="margin-top: 20px;">
                <strong>Select a variant:</strong>
                <div class="variants-container" style="margin-top: 10px;">
                    ${variantsHtml}
                </div>
            </div>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'block';
    
    // Store current conflict info for selection
    modal.dataset.conflictIndex = conflictIndex;
    modal.dataset.factIndex = factIndex;
}

function selectConflictVariant(conflictIndex, variantIndex, value) {
    // Call the existing acceptConflictVersion function
    acceptConflictVersion(conflictIndex, variantIndex, value);
}

function showResolvedConflictDetails(conflictIndex, fact, factIndex) {
    if (!currentFactsData || !currentFactsData.conflicts || !currentFactsData.conflicts[conflictIndex]) {
        showError('Conflict not found.');
        return;
    }
    
    const conflict = currentFactsData.conflicts[conflictIndex];
    // Use String() for consistent key type matching
    const acceptedVersion = currentFactsData.acceptedVersions && currentFactsData.acceptedVersions[String(conflictIndex)];
    const modal = document.getElementById('conflictModal');
    const modalBody = document.getElementById('conflictModalBody');
    
    if (!modal || !modalBody) {
        showError('Modal elements not found.');
        return;
    }
    
    const acceptedValue = acceptedVersion ? acceptedVersion.value : 'N/A';
    const acceptedTimestamp = acceptedVersion ? new Date(acceptedVersion.timestamp).toLocaleString() : 'N/A';
    
    // Build value variants display
    const valueDetails = conflict.value_details || [];
    let variantsHtml = '';
    
    if (valueDetails.length > 0) {
        variantsHtml = valueDetails.map((valueDetail, variantIndex) => {
            const value = valueDetail.value || '';
            const sources = valueDetail.sources || [];
            const snippets = valueDetail.source_snippets || [];
            const isAccepted = value === acceptedValue;
            
            return `
                <div class="conflict-variant-item ${isAccepted ? 'selected' : ''}" style="opacity: ${isAccepted ? '1' : '0.6'};">
                    <div class="conflict-variant-header">
                        <span class="conflict-variant-value">${escapeHtml(value)}</span>
                        <div class="conflict-variant-badges">
                            ${isAccepted ? '<span class="accepted-badge">Accepted</span>' : ''}
                        </div>
                    </div>
                    <div class="conflict-variant-sources">
                        <strong>Sources:</strong> ${sources.map(s => `<span class="source-badge source-${s}">${s.replace('_', ' ')}</span>`).join(', ')}
                    </div>
                    ${snippets.length > 0 ? `
                        <div class="conflict-variant-snippets">
                            ${snippets.map(snippet => `<div class="conflict-snippet">${escapeHtml(snippet)}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } else {
        // Fallback to conflicting_values
        variantsHtml = (conflict.conflicting_values || []).map((value) => {
            const isAccepted = value === acceptedValue;
            return `
                <div class="conflict-variant-item ${isAccepted ? 'selected' : ''}" style="opacity: ${isAccepted ? '1' : '0.6'};">
                    <div class="conflict-variant-header">
                        <span class="conflict-variant-value">${escapeHtml(value)}</span>
                        ${isAccepted ? '<span class="accepted-badge">Accepted</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Build modal content
    modalBody.innerHTML = `
        <div>
            <h4 style="margin-top: 0;">Resolved Conflict Details</h4>
            <div style="margin: 15px 0; padding: 15px; background: #e8f5e9; border-radius: 6px; border-left: 4px solid #4CAF50;">
                <div style="margin-bottom: 10px;">
                    <strong>Conflict Description:</strong> ${escapeHtml(conflict.fact_description || 'Conflict')}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Accepted Value:</strong> <span class="highlight" style="color: #2e7d32; font-weight: bold;">${escapeHtml(acceptedValue)}</span>
                </div>
                <div>
                    <strong>Resolved At:</strong> ${acceptedTimestamp}
                </div>
            </div>
            ${conflict.explanation ? `<p><strong>Explanation:</strong> ${escapeHtml(conflict.explanation)}</p>` : ''}
            <div style="margin-top: 20px;">
                <strong>All Variants:</strong>
                <div class="variants-container" style="margin-top: 10px;">
                    ${variantsHtml}
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button class="summary-button" onclick="closeConflictModal()" style="padding: 8px 20px;">Close</button>
            </div>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'block';
}

function showAllConflictsResolvedPopup() {
    console.log('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] Showing popup for all conflicts resolved');
    console.log('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] Timestamp:', new Date().toISOString());
    
    const modal = document.getElementById('conflictModal');
    const modalBody = document.getElementById('conflictModalBody');
    
    if (!modal || !modalBody) {
        console.error('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] ERROR: Modal elements not found');
        showError('Modal elements not found.');
        return;
    }
    
    console.log('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] Modal elements found, building popup content');
    console.log('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] Liability signal call should have been auto-triggered');
    
    // Build modal content
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">✓</div>
            <h3 style="margin-top: 0; color: #4CAF50;">Thank You for Closing All Conflicts</h3>
            <p style="font-size: 1.1em; color: #666; margin: 20px 0;">
                We will now generate liability signals based on the resolved conflicts.
            </p>
            <div style="margin-top: 30px;">
                <button class="summary-button" onclick="closeAllConflictsResolvedPopup()" style="padding: 12px 30px; font-size: 1em;">
                    Okay
                </button>
            </div>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'block';
    console.log('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] Popup displayed');
    
    // Store flag to indicate this is the all-conflicts-resolved popup
    modal.dataset.allConflictsResolved = 'true';
    console.log('LIABILITY_SIGNAL_LOG: [showAllConflictsResolvedPopup] Popup flag set');
}

function closeAllConflictsResolvedPopup() {
    console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Closing popup');
    console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Timestamp:', new Date().toISOString());
    
    const modal = document.getElementById('conflictModal');
    if (modal) {
        modal.style.display = 'none';
        delete modal.dataset.allConflictsResolved;
        console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Modal closed and flag removed');
    }
    
    // Check current state before deciding whether to call analyzeLiabilitySignals
    console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Checking liability signals state:');
    console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] - step1Completion.liabilitySignals:', step1Completion.liabilitySignals);
    console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] - currentLiabilitySignalsData exists:', !!currentLiabilitySignalsData);
    console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] - currentLiabilitySignalsData signals count:', currentLiabilitySignalsData?.signals?.length || 0);
    
    // If liability signals haven't been analyzed yet, analyze them now
    if (!step1Completion.liabilitySignals || !currentLiabilitySignalsData) {
        console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Liability signals not analyzed yet, will trigger analysis');
        // Automatically analyze liability signals
        setTimeout(() => {
            console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Executing analyzeLiabilitySignals() after timeout (500ms)...');
            analyzeLiabilitySignals();
        }, 500);
    } else {
        console.log('LIABILITY_SIGNAL_LOG: [closeAllConflictsResolvedPopup] Liability signals already exist, re-analyzing to reflect updated facts');
        // Re-analyze liability signals if they exist (to reflect updated facts)
        analyzeLiabilitySignals();
    }
}

function closeConflictModal() {
    const modal = document.getElementById('conflictModal');
    if (modal) {
        // Check if this is the all-conflicts-resolved popup
        if (modal.dataset.allConflictsResolved === 'true') {
            closeAllConflictsResolvedPopup();
            return;
        }
        modal.style.display = 'none';
        delete modal.dataset.conflictIndex;
        delete modal.dataset.factIndex;
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const conflictModal = document.getElementById('conflictModal');
    if (event.target === conflictModal) {
        closeConflictModal();
    }
    const supervisorEscalationModal = document.getElementById('supervisorEscalationModal');
    if (event.target === supervisorEscalationModal) {
        closeSupervisorEscalationModal();
    }
}

function exportFactsAsJSON() {
    if (!currentFactsData) {
        showError('No facts data to export.');
        return;
    }
    
    const dataStr = JSON.stringify(currentFactsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fact_matrix.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function displayContent(data) {
    if (data.type === 'image') {
        // Display image content
        metadataDiv.innerHTML = `
            <h2>Image Information</h2>
            <div class="metadata-item">
                <strong>Filename:</strong> ${escapeHtml(data.filename || data.originalFilename || 'Unknown')}
            </div>
            <div class="metadata-item">
                <strong>Dimensions:</strong> ${data.width} × ${data.height} pixels
            </div>
            <div class="metadata-item">
                <strong>Format:</strong> ${data.format || 'Unknown'}
            </div>
            ${data.size ? `<div class="metadata-item"><strong>Size:</strong> ${formatFileSize(data.size)}</div>` : ''}
        `;
        
        pagesDiv.innerHTML = `
            <div class="image-display">
                <img src="${data.data}" alt="${escapeHtml(data.filename || 'Image')}" class="uploaded-image">
            </div>
        `;
    } else if (data.type === 'audio') {
        // Display audio transcription
        const transcription = data.transcription || (data.pages && data.pages.length > 0 ? data.pages[0].text : '');
        metadataDiv.innerHTML = `
            <h2>Audio Recording Information</h2>
            <div class="metadata-item">
                <strong>Filename:</strong> ${escapeHtml(data.filename || data.originalFilename || 'Unknown')}
            </div>
            <div class="metadata-item">
                <strong>Type:</strong> Audio Recording
            </div>
            ${transcription ? `<div class="metadata-item"><strong>Transcription Status:</strong> Complete</div>` : '<div class="metadata-item"><strong>Transcription Status:</strong> Not available</div>'}
        `;
        
        pagesDiv.innerHTML = '';
        
        if (!transcription || transcription.trim() === '') {
            pagesDiv.innerHTML = '<div class="empty-text">No transcription available for this audio file.</div>';
        } else {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            
            // Page header
            const pageHeader = document.createElement('div');
            pageHeader.className = 'page-header';
            pageHeader.innerHTML = `
                <span class="page-number">Transcription</span>
            `;
            
            // Transcription text
            const transcriptionText = document.createElement('div');
            transcriptionText.className = 'page-text';
            transcriptionText.textContent = transcription;
            
            pageDiv.appendChild(pageHeader);
            pageDiv.appendChild(transcriptionText);
            pagesDiv.appendChild(pageDiv);
        }
    } else {
        // Display PDF content
        const metadata = data.metadata || {};
        metadataDiv.innerHTML = `
            <h2>Document Information</h2>
            <div class="metadata-item">
                <strong>Filename:</strong> ${escapeHtml(data.filename || data.originalFilename || 'Unknown')}
            </div>
            <div class="metadata-item">
                <strong>Pages:</strong> ${metadata.page_count || 0}
            </div>
            ${metadata.title ? `<div class="metadata-item"><strong>Title:</strong> ${escapeHtml(metadata.title)}</div>` : ''}
            ${metadata.author ? `<div class="metadata-item"><strong>Author:</strong> ${escapeHtml(metadata.author)}</div>` : ''}
            ${metadata.subject ? `<div class="metadata-item"><strong>Subject:</strong> ${escapeHtml(metadata.subject)}</div>` : ''}
        `;
        
        // Display pages
        pagesDiv.innerHTML = '';
        
        if (!data.pages || data.pages.length === 0) {
            pagesDiv.innerHTML = '<div class="empty-text">No content found in PDF.</div>';
        } else {
            data.pages.forEach(page => {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page';
                
                // Page header
                const pageHeader = document.createElement('div');
                pageHeader.className = 'page-header';
                pageHeader.innerHTML = `
                    <span class="page-number">Page ${page.page_number}</span>
                    <span class="page-dimensions">${Math.round(page.width)} × ${Math.round(page.height)} pts</span>
                `;
                
                // Page text
                const pageText = document.createElement('div');
                pageText.className = 'page-text';
                if (page.text && page.text.trim()) {
                    pageText.textContent = page.text;
                } else {
                    pageText.innerHTML = '<div class="empty-text">No text content on this page.</div>';
                }
                
                // Page images
                const pageImages = document.createElement('div');
                pageImages.className = 'page-images';
                
                if (page.images && page.images.length > 0) {
                    page.images.forEach((img, index) => {
                        const imgDiv = document.createElement('div');
                        imgDiv.className = 'page-image';
                        
                        const imgElement = document.createElement('img');
                        imgElement.src = img.data;
                        imgElement.alt = `Image ${index + 1} from page ${page.page_number}`;
                        imgElement.loading = 'lazy';
                        
                        const imgLabel = document.createElement('div');
                        imgLabel.className = 'page-image-label';
                        imgLabel.textContent = `Image ${index + 1} (${img.ext.toUpperCase()})`;
                        
                        imgDiv.appendChild(imgElement);
                        imgDiv.appendChild(imgLabel);
                        pageImages.appendChild(imgDiv);
                    });
                } else {
                    pageImages.innerHTML = '<div class="empty-images">No images on this page.</div>';
                }
                
                pageDiv.appendChild(pageHeader);
                pageDiv.appendChild(pageText);
                pageDiv.appendChild(pageImages);
                pagesDiv.appendChild(pageDiv);
            });
        }
    }
    
    // Scroll to top of content
    fileContentView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    loading.style.display = 'none';
    
    setTimeout(() => {
        error.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    // Insert after error div
    error.parentNode.insertBefore(successDiv, error.nextSibling);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function analyzeLiabilitySignals() {
    const timestamp = new Date().toISOString();
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] ========== ENTRY POINT ==========');
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Timestamp:', timestamp);
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Function called from:', new Error().stack?.split('\n')[2]?.trim() || 'unknown');
    
    // Check if fact matrix exists
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Validating facts data...');
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - currentFactsData exists:', !!currentFactsData);
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - currentFactsData.facts exists:', !!currentFactsData?.facts);
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - currentFactsData.facts length:', currentFactsData?.facts?.length || 0);
    
    if (!currentFactsData || !currentFactsData.facts || currentFactsData.facts.length === 0) {
        console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] ERROR: No facts data available');
        showError('Please extract facts first before analyzing liability signals.');
        return;
    }
    
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Facts validation passed');
    
    // Switch to Fact Matrix tab (if not already there)
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Switching to fact-matrix tab');
    switchTab('fact-matrix');
    
    // Ensure table is visible (don't hide it with loading indicator)
    const factTable = document.getElementById('factTable');
    if (factTable) {
        factTable.style.display = 'table';
    }
    
    // Show "Processing..." in liability columns immediately (don't replace table)
    showProcessingInLiabilityColumns();
    
    error.style.display = 'none';
    
    // Prepare facts data to send
    const factsData = currentFactsData.facts;
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Preparing request data:');
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Facts count:', factsData.length);
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Facts sample (first 2):', factsData.slice(0, 2).map(f => ({
        category: f.category,
        source: f.source,
        extracted_fact: f.extracted_fact?.substring(0, 50) + '...'
    })));
    
    // Send to backend
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Initiating API call to /analyze-liability-signals');
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Request method: POST');
    console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Request body size:', JSON.stringify({ facts: factsData }).length, 'bytes');
    
    const requestStartTime = Date.now();
    fetch('/analyze-liability-signals', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ facts: factsData })
    })
    .then(response => {
        const requestDuration = Date.now() - requestStartTime;
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] API response received');
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Status:', response.status, response.statusText);
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Request duration:', requestDuration, 'ms');
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Response headers:', Object.fromEntries(response.headers.entries()));
        return response.json();
    })
    .then(data => {
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Response data parsed');
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Has error:', !!data.error);
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Has signals:', !!data.signals);
        console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Signals count:', data.signals?.length || 0);
        
        if (data.error) {
            console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] ERROR from server:', data.error);
            clearProcessingFromLiabilityColumns();
            showError(data.error);
        } else if (data.signals) {
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Success! Processing signals data...');
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] - Signals sample:', data.signals.slice(0, 2).map(s => ({
                signal_type: s.signal_type,
                severity_score: s.severity_score
            })));
            
            // Store signals data
            currentLiabilitySignalsData = data;
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Stored signals data in currentLiabilitySignalsData');
            
            // Mark Step 1 liability signals as complete
            step1Completion.liabilitySignals = true;
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Marked step1Completion.liabilitySignals = true');
            
            updateStep2Access();
            updateStepIndicators();
            updateProgress();
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Updated step access, indicators, and progress');
            
            // Display liability signals (will update fact table)
            displayLiabilitySignals(data);
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Displayed liability signals');
            
            showSuccess('Facts extracted and liability signals analyzed successfully.');
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] ========== SUCCESS COMPLETE ==========');
        } else {
            console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] ERROR: No signals in response');
            console.log('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Response data:', data);
            clearProcessingFromLiabilityColumns();
            showError('No signals received from server.');
        }
    })
    .catch(err => {
        const requestDuration = Date.now() - requestStartTime;
        console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] ========== ERROR ==========');
        console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Request duration before error:', requestDuration, 'ms');
        console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Error object:', err);
        console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Error message:', err.message);
        console.error('LIABILITY_SIGNAL_LOG: [analyzeLiabilitySignals] Error stack:', err.stack);
        
        clearProcessingFromLiabilityColumns();
        showError('Failed to analyze liability signals. Please try again.');
        console.error('Error:', err);
    });
}

function displayLiabilitySignals(signalsData) {
    // Store signals data
    currentLiabilitySignalsData = signalsData;
    
    // Update liability columns with actual data
    updateLiabilityColumns(signalsData);
}

function showProcessingInLiabilityColumns() {
    // Show "Processing..." in all liability columns
    const allRows = factTableBody.querySelectorAll('tr');
    allRows.forEach((row, index) => {
        const signalTypeCell = row.querySelector('.liability-signal-type-cell');
        const impactCell = row.querySelector('.liability-impact-cell');
        const severityCell = row.querySelector('.liability-severity-cell');
        
        if (signalTypeCell) {
            signalTypeCell.innerHTML = '<span style="color: #999; font-style: italic;">Processing...</span>';
        }
        if (impactCell) {
            impactCell.innerHTML = '<span style="color: #999; font-style: italic;">Processing...</span>';
        }
        if (severityCell) {
            severityCell.innerHTML = '<span style="color: #999; font-style: italic;">Processing...</span>';
        }
    });
}

function clearProcessingFromLiabilityColumns() {
    // Clear "Processing..." from all liability columns (show empty or dash)
    const allRows = factTableBody.querySelectorAll('tr');
    allRows.forEach((row, index) => {
        const signalTypeCell = row.querySelector('.liability-signal-type-cell');
        const impactCell = row.querySelector('.liability-impact-cell');
        const severityCell = row.querySelector('.liability-severity-cell');
        
        if (signalTypeCell && signalTypeCell.innerHTML.includes('Processing...')) {
            signalTypeCell.textContent = '—';
        }
        if (impactCell && impactCell.innerHTML.includes('Processing...')) {
            impactCell.textContent = '—';
        }
        if (severityCell && severityCell.innerHTML.includes('Processing...')) {
            severityCell.textContent = '—';
        }
    });
}

function checkIfAllConflictsResolved() {
    const timestamp = new Date().toISOString();
    console.log('LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] ========== CHECKING CONFLICT RESOLUTION ==========');
    console.log('LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Timestamp:', timestamp);
    console.log('DEBUG: checkIfAllConflictsResolved called');
    console.log('DEBUG: currentFactsData exists:', !!currentFactsData);
    
    if (!currentFactsData) {
        console.log('LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] No currentFactsData - returning true (no conflicts)');
        console.log('DEBUG: currentFactsData is null/undefined');
        return true; // No data means no conflicts
    }
    
    console.log('LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] currentFactsData exists, checking conflicts...');
    console.log('DEBUG: currentFactsData.conflicts exists:', !!currentFactsData.conflicts);
    console.log('DEBUG: currentFactsData.conflicts type:', typeof currentFactsData.conflicts);
    console.log('DEBUG: currentFactsData.conflicts is array:', Array.isArray(currentFactsData.conflicts));
    
    if (!currentFactsData.conflicts || currentFactsData.conflicts.length === 0) {
        console.log('LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] No conflicts found - ALL RESOLVED');
        console.log('DEBUG: No conflicts found, all resolved');
        return true;
    }
    
    const conflictsCount = currentFactsData.conflicts.length;
    console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Found ${conflictsCount} conflicts to check`);
    console.log(`DEBUG: Found ${conflictsCount} conflicts`);
    console.log('DEBUG: Full conflicts array:', JSON.stringify(currentFactsData.conflicts, null, 2));
    console.log('DEBUG: acceptedVersions exists:', !!currentFactsData.acceptedVersions);
    console.log('DEBUG: acceptedVersions type:', typeof currentFactsData.acceptedVersions);
    console.log('DEBUG: acceptedVersions:', currentFactsData.acceptedVersions);
    console.log('DEBUG: acceptedVersions JSON:', JSON.stringify(currentFactsData.acceptedVersions, null, 2));
    
    if (!currentFactsData.acceptedVersions) {
        console.log('LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] No acceptedVersions object - NOT ALL RESOLVED');
        console.log('DEBUG: acceptedVersions object does not exist');
        console.log('DEBUG: currentFactsData keys:', Object.keys(currentFactsData));
        return false;
    }
    
    const acceptedVersionsCount = Object.keys(currentFactsData.acceptedVersions).length;
    console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Found ${acceptedVersionsCount} accepted versions`);
    console.log('DEBUG: acceptedVersions keys:', Object.keys(currentFactsData.acceptedVersions));
    console.log('DEBUG: acceptedVersions keys types:', Object.keys(currentFactsData.acceptedVersions).map(k => `${k} (${typeof k})`));
    console.log('DEBUG: acceptedVersions entries:', Object.entries(currentFactsData.acceptedVersions));
    
    // Helper function to match conflict by content (sources and values) as fallback
    const findAcceptedVersionByContent = (conflict) => {
        if (!conflict || !currentFactsData.acceptedVersions) return null;
        
        const conflictSources = conflict.sources || [];
        const conflictValues = conflict.conflicting_values || [];
        const conflictSourcesStr = JSON.stringify(conflictSources.sort());
        const conflictValuesStr = JSON.stringify(conflictValues.sort());
        
        // Check all accepted versions to find one that matches this conflict's content
        for (const [key, acceptedVersion] of Object.entries(currentFactsData.acceptedVersions)) {
            // Try to find the original conflict that this accepted version belongs to
            const originalConflictIndex = parseInt(key);
            if (!isNaN(originalConflictIndex) && currentFactsData.conflicts[originalConflictIndex]) {
                const originalConflict = currentFactsData.conflicts[originalConflictIndex];
                const originalSources = originalConflict.sources || [];
                const originalValues = originalConflict.conflicting_values || [];
                const originalSourcesStr = JSON.stringify(originalSources.sort());
                const originalValuesStr = JSON.stringify(originalValues.sort());
                
                // Check if sources and values match
                if (originalSourcesStr === conflictSourcesStr && originalValuesStr === conflictValuesStr) {
                    console.log(`DEBUG: [Content Match] Found accepted version for conflict by content matching (key: ${key})`);
                    return acceptedVersion;
                }
            }
        }
        return null;
    };
    
    // Check if all conflicts have accepted versions
    // Use String(idx) to ensure consistent key type matching (acceptedVersions keys are stored as strings)
    let resolvedCount = 0;
    const allResolved = currentFactsData.conflicts.every((c, idx) => {
        const key = String(idx);
        const keyNum = idx;
        const keyStr = String(idx);
        
        console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Checking conflict ${idx}/${conflictsCount - 1}:`);
        console.log(`DEBUG: Checking conflict ${idx}:`);
        console.log(`  - key (String(idx)): "${key}" (type: ${typeof key})`);
        console.log(`  - keyNum: ${keyNum} (type: ${typeof keyNum})`);
        console.log(`  - keyStr: "${keyStr}" (type: ${typeof keyStr})`);
        console.log(`  - conflict object:`, c);
        
        // Try multiple key formats - check all possible variations
        let hasAcceptedStr = currentFactsData.acceptedVersions && currentFactsData.acceptedVersions[keyStr];
        let hasAcceptedNum = currentFactsData.acceptedVersions && currentFactsData.acceptedVersions[keyNum];
        
        // Also try checking all keys in acceptedVersions for any numeric/string variations
        if (!hasAcceptedStr && !hasAcceptedNum) {
            // Check all keys to see if any match this index (handles edge cases)
            const allKeys = Object.keys(currentFactsData.acceptedVersions);
            for (const avKey of allKeys) {
                const avKeyNum = Number(avKey);
                if (!isNaN(avKeyNum) && avKeyNum === idx) {
                    hasAcceptedStr = currentFactsData.acceptedVersions[avKey];
                    console.log(`DEBUG: [Key Match] Found accepted version using alternative key format: "${avKey}"`);
                    break;
                }
            }
        }
        
        // If still not found, try content-based matching as fallback
        if (!hasAcceptedStr && !hasAcceptedNum) {
            const contentMatch = findAcceptedVersionByContent(c);
            if (contentMatch) {
                hasAcceptedStr = contentMatch;
                console.log(`DEBUG: [Content Fallback] Found accepted version for conflict ${idx} using content matching`);
            }
        }
        
        const hasAccepted = hasAcceptedStr || hasAcceptedNum;
        
        console.log(`  - acceptedVersions["${keyStr}"]:`, hasAcceptedStr);
        console.log(`  - acceptedVersions[${keyNum}]:`, hasAcceptedNum);
        console.log(`  - hasAccepted (combined):`, !!hasAccepted);
        
        if (!hasAccepted) {
            console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Conflict ${idx} MISSING accepted version`);
            console.log(`DEBUG: Conflict ${idx} missing accepted version.`);
            console.log(`  - Available keys:`, Object.keys(currentFactsData.acceptedVersions));
            console.log(`  - Available keys with types:`, Object.keys(currentFactsData.acceptedVersions).map(k => `"${k}" (${typeof k})`));
            console.log(`  - Checking if key exists with different format...`);
            console.log(`  - Has key "${keyStr}":`, keyStr in currentFactsData.acceptedVersions);
            console.log(`  - Has key ${keyNum}:`, keyNum in currentFactsData.acceptedVersions);
            console.log(`  - All acceptedVersions entries:`, Object.entries(currentFactsData.acceptedVersions));
            console.log(`  - Conflict sources:`, c.sources);
            console.log(`  - Conflict values:`, c.conflicting_values);
        } else {
            resolvedCount++;
            console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Conflict ${idx} HAS accepted version`);
            console.log(`  - Accepted version found:`, hasAcceptedStr || hasAcceptedNum);
        }
        
        return hasAccepted;
    });
    
    // Count-based validation: if we have at least as many accepted versions as conflicts, consider resolved
    // This handles edge cases where keys might not match exactly but all conflicts are resolved
    const countBasedResolved = acceptedVersionsCount >= conflictsCount && resolvedCount === conflictsCount;
    
    console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] ========== RESULT: ${allResolved ? 'ALL RESOLVED' : 'NOT ALL RESOLVED'} ==========`);
    console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Conflicts: ${conflictsCount}, Accepted: ${acceptedVersionsCount}, Resolved by index: ${resolvedCount}, All Resolved: ${allResolved}`);
    console.log(`LIABILITY_SIGNAL_LOG: [checkIfAllConflictsResolved] Count-based check: ${acceptedVersionsCount} >= ${conflictsCount} && ${resolvedCount} === ${conflictsCount} = ${countBasedResolved}`);
    console.log(`DEBUG: All conflicts resolved: ${allResolved}`);
    console.log(`DEBUG: Final check result: ${allResolved || countBasedResolved}`);
    
    // Return true if either index-based check passes OR count-based check passes
    return allResolved || countBasedResolved;
}

function updateLiabilityColumns(signalsData) {
    if (!currentFactsData || !currentFactsData.facts) {
        return;
    }
    
    const signals = signalsData.signals || [];
    const allRows = factTableBody.querySelectorAll('tr');
    
    allRows.forEach((row, index) => {
        const fact = currentFactsData.facts[index];
        if (!fact) return;
        
        // Find matching signal for this fact
        const signalInfo = getFactSignalInfo(fact, index);
        
        // Update Signal Type cell
        const signalTypeCell = row.querySelector('.liability-signal-type-cell');
        if (signalTypeCell) {
            if (signalInfo && signalInfo.signal_type) {
                const signalType = signalInfo.signal_type || 'unknown';
                signalTypeCell.innerHTML = `<span class="signal-type-badge signal-type-${signalType.replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(signalType)}</span>`;
            } else {
                signalTypeCell.textContent = '—';
            }
        }
        
        // Update Impact cell
        const impactCell = row.querySelector('.liability-impact-cell');
        if (impactCell) {
            if (signalInfo && signalInfo.impact_on_liability) {
                impactCell.textContent = signalInfo.impact_on_liability;
            } else {
                impactCell.textContent = '—';
            }
        }
        
        // Update Severity cell
        const severityCell = row.querySelector('.liability-severity-cell');
        if (severityCell) {
            if (signalInfo && signalInfo.severity_score !== undefined) {
                const severity = signalInfo.severity_score || 0;
                const severityPercent = Math.round(severity * 100);
                severityCell.innerHTML = `
                    <div class="severity-container">
                        <div class="severity-bar">
                            <div class="severity-fill" style="width: ${severityPercent}%"></div>
                        </div>
                        <span class="severity-text">${severityPercent}%</span>
                    </div>
                `;
            } else {
                severityCell.textContent = '—';
            }
        }
    });
}

function renderLiabilitySignalsTable(signals) {
    const tableBody = document.getElementById('liabilitySignalsTableBody');
    tableBody.innerHTML = '';
    
    if (!signals || signals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No liability signals identified.</td></tr>';
        return;
    }
    
    signals.forEach((signal, index) => {
        const row = renderLiabilitySignalRow(signal, index);
        tableBody.appendChild(row);
    });
}

function renderLiabilitySignalRow(signal, index) {
    const row = document.createElement('tr');
    row.dataset.index = index;
    
    // Signal Type (with badge)
    const signalTypeCell = document.createElement('td');
    const signalType = signal.signal_type || 'unknown';
    signalTypeCell.innerHTML = `<span class="signal-type-badge signal-type-${signalType.replace(/\s+/g, '-').toLowerCase()}">${escapeHtml(signalType)}</span>`;
    
    // Evidence Text (truncated with expand)
    const evidenceTextCell = document.createElement('td');
    const evidenceText = signal.evidence_text || '';
    const truncatedEvidence = evidenceText.length > 150 ? evidenceText.substring(0, 150) + '...' : evidenceText;
    evidenceTextCell.innerHTML = `
        <div class="evidence-text-container">
            <span class="evidence-text-short">${escapeHtml(truncatedEvidence)}</span>
            ${evidenceText.length > 150 ? `<button class="expand-text-btn" onclick="toggleEvidenceText(${index})">Show more</button>` : ''}
            <span class="evidence-text-full" style="display: none;">${escapeHtml(evidenceText)}</span>
        </div>
    `;
    
    // Impact on Liability
    const impactCell = document.createElement('td');
    impactCell.textContent = signal.impact_on_liability || 'N/A';
    
    // Severity Score (with visual indicator)
    const severityCell = document.createElement('td');
    const severity = signal.severity_score || 0;
    const severityPercent = Math.round(severity * 100);
    severityCell.innerHTML = `
        <div class="severity-container">
            <div class="severity-bar">
                <div class="severity-fill" style="width: ${severityPercent}%"></div>
            </div>
            <span class="severity-text">${severityPercent}%</span>
        </div>
    `;
    
    // Related Facts
    const relatedFactsCell = document.createElement('td');
    const relatedFacts = signal.related_facts || [];
    if (relatedFacts.length > 0) {
        const factsList = relatedFacts.map((fact, idx) => {
            const factText = typeof fact === 'string' ? fact : JSON.stringify(fact);
            const truncatedFact = factText.length > 80 ? factText.substring(0, 80) + '...' : factText;
            return `<div class="related-fact-item">${escapeHtml(truncatedFact)}</div>`;
        }).join('');
        relatedFactsCell.innerHTML = `<div class="related-facts-list">${factsList}</div>`;
    } else {
        relatedFactsCell.textContent = 'None';
    }
    
    // Discrepancies
    const discrepanciesCell = document.createElement('td');
    const discrepancies = signal.discrepancies || '';
    if (discrepancies) {
        discrepanciesCell.innerHTML = `<span class="discrepancy-flag">${escapeHtml(discrepancies)}</span>`;
    } else {
        discrepanciesCell.innerHTML = '<span class="no-discrepancy">None</span>';
    }
    
    row.appendChild(signalTypeCell);
    row.appendChild(evidenceTextCell);
    row.appendChild(impactCell);
    row.appendChild(severityCell);
    row.appendChild(relatedFactsCell);
    row.appendChild(discrepanciesCell);
    
    return row;
}

function toggleEvidenceText(index) {
    const row = document.querySelector(`#liabilitySignalsTableBody tr[data-index="${index}"]`);
    if (!row) return;
    
    const shortText = row.querySelector('.evidence-text-short');
    const fullText = row.querySelector('.evidence-text-full');
    const button = row.querySelector('.expand-text-btn');
    
    if (fullText && button) {
        if (fullText.style.display === 'none') {
            shortText.style.display = 'none';
            fullText.style.display = 'inline';
            button.textContent = 'Show less';
        } else {
            shortText.style.display = 'inline';
            fullText.style.display = 'none';
            button.textContent = 'Show more';
        }
    }
}

function checkEvidenceCompleteness() {
    // Check if files are uploaded
    if (!uploadedFiles || Object.keys(uploadedFiles).length === 0) {
        // No files uploaded yet, don't check
        // Hide loading and checks summary, but keep section visible
        const evidenceLoading = document.getElementById('evidenceCompletenessLoading');
        const checksSummary = document.getElementById('checksSummarySection');
        if (evidenceLoading) {
            evidenceLoading.style.display = 'none';
        }
        if (checksSummary) {
            checksSummary.style.display = 'none';
        }
        return;
    }
    
    // Show evidence completeness section in files tab (always visible now)
    const evidenceSection = document.getElementById('evidenceCompletenessSection');
    const evidenceLoading = document.getElementById('evidenceCompletenessLoading');
    const checksSummary = document.getElementById('checksSummarySection');
    
    if (evidenceSection) {
        evidenceSection.style.display = 'block';
    }
    
    // Show loading state
    if (evidenceLoading) {
        evidenceLoading.style.display = 'block';
    }
    if (checksSummary) {
        checksSummary.style.display = 'none';
    }
    
    error.style.display = 'none';
    
    // Prepare files data to send
    const filesData = Object.values(uploadedFiles);
    
    // Send to backend
    fetch('/check-evidence-completeness', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: filesData })
    })
    .then(response => response.json())
    .then(data => {
        hideTabLoading('evidenceCompleteness');
        
        if (data.error) {
            showError(data.error);
        } else if (data.checks || data.missing_evidence) {
            // Mark Step 1 evidence completeness as complete
            step1Completion.evidenceComplete = true;
            updateStep2Access();
            updateStepIndicators();
            updateProgress();
            // Display evidence completeness results
            displayEvidenceCompleteness(data);
        } else {
            showError('No completeness data received from server.');
        }
    })
    .catch(err => {
        hideTabLoading('evidenceCompleteness');
        showError('Failed to check evidence completeness. Please try again.');
        console.error('Error:', err);
    });
}

function displayEvidenceCompleteness(data) {
    // Display in files tab (don't switch tabs)
    const checksSummarySection = document.getElementById('checksSummarySection');
    
    // Store missing evidence globally for email modal
    currentMissingEvidence = data.missing_evidence || [];
    
    // Display checks summary
    if (data.checks) {
        if (checksSummarySection) {
            checksSummarySection.style.display = 'block';
        }
        renderChecksSummary(data.checks);
    } else {
        if (checksSummarySection) {
            checksSummarySection.style.display = 'none';
        }
    }
    
    // Show/hide "Request More Details" button based on missing evidence
    const requestButton = document.getElementById('requestMoreDetailsButton');
    if (requestButton) {
        if (currentMissingEvidence && currentMissingEvidence.length > 0) {
            requestButton.style.display = 'inline-block';
        } else {
            requestButton.style.display = 'none';
        }
    }
    
    // Update email status indicators
    updateEmailStatusIndicators();
    
    // Scroll to evidence completeness section
    const evidenceSection = document.getElementById('evidenceCompletenessSection');
    if (evidenceSection) {
        evidenceSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function renderChecksSummary(checks) {
    const checksTableBody = document.getElementById('checksTableBody');
    if (!checksTableBody) return;
    
    checksTableBody.innerHTML = '';
    
    const checkItems = [
        { key: 'turn_by_turn_photos', label: 'Turn-by-Turn Incident Photos', icon: '📸' },
        { key: 'vehicle_damage_angles', label: 'Vehicle Damage Angles', icon: '🚗' },
        { key: 'police_report', label: 'Police Report', icon: '👮' },
        { key: 'timestamps_location', label: 'Timestamps & Location Data', icon: '📍' },
        { key: 'driver_statements', label: 'Driver Statements', icon: '📝' },
        { key: 'document_metadata', label: 'Document Metadata', icon: '📋' }
    ];
    
    checkItems.forEach(item => {
        const check = checks[item.key];
        if (!check) return;
        
        const row = document.createElement('tr');
        row.className = 'evidence-check-row';
        row.setAttribute('data-evidence-key', item.key); // Store checkItem key for matching
        
        const statusClass = check.status === 'complete' ? 'status-complete' : 
                           check.status === 'partial' ? 'status-partial' : 'status-missing';
        const statusIcon = check.status === 'complete' ? '✅' : 
                         check.status === 'partial' ? '⚠️' : '❌';
        const statusText = check.status === 'complete' ? 'Complete' : 
                          check.status === 'partial' ? 'Partial' : 
                          check.status === 'missing' ? 'Missing' : 'Unknown';
        
        row.innerHTML = `
            <td>
                <span class="check-icon">${item.icon}</span>
                <span class="check-label">${escapeHtml(item.label)}</span>
            </td>
            <td>
                <span class="check-status ${statusClass}">${statusIcon} ${statusText}</span>
            </td>
            <td class="check-details-cell">${escapeHtml(check.details || 'No details available')}</td>
        `;
        
        checksTableBody.appendChild(row);
    });
}

function generateLiabilityRecommendationForTab() {
    // Check if fact matrix exists
    if (!currentFactsData || !currentFactsData.facts || currentFactsData.facts.length === 0) {
        showError('Please extract facts first before getting liability recommendation.');
        return;
    }
    
    // Check if liability signals exist
    if (!currentLiabilitySignalsData || !currentLiabilitySignalsData.signals || currentLiabilitySignalsData.signals.length === 0) {
        showError('Please analyze liability signals first before getting liability recommendation.');
        return;
    }
    
    // Switch to Liability Recommendation tab first
    switchTab('liability-recommendation');
    
    // Show loading state in the tab
    showTabLoading('liabilityRecommendation', 'Generating liability recommendation...');
    error.style.display = 'none';
    
    // Prepare facts and signals data to send
    const factsData = currentFactsData.facts;
    const signalsData = currentLiabilitySignalsData.signals;
    
    // Send to backend
    fetch('/get-liability-recommendation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ facts: factsData, signals: signalsData })
    })
    .then(response => response.json())
    .then(data => {
        hideTabLoading('liabilityRecommendation');
        
        if (data.error) {
            showError(data.error);
        } else if (data.claimant_liability_percent !== undefined && data.other_driver_liability_percent !== undefined) {
            // Store recommendation data
            currentLiabilityRecommendationData = data;
            updateStepIndicators();
            updateProgress();
            // Display liability recommendation (skip tab switch since we're already on the tab)
            displayLiabilityRecommendation(data, true);
        } else {
            showError('No recommendation received from server.');
        }
    })
    .catch(err => {
        hideTabLoading('liabilityRecommendation');
        showError('Failed to get liability recommendation. Please try again.');
        console.error('Error:', err);
    });
}

function getLiabilityRecommendation() {
    // Check if fact matrix exists
    if (!currentFactsData || !currentFactsData.facts || currentFactsData.facts.length === 0) {
        showError('Please extract facts first before getting liability recommendation.');
        return;
    }
    
    // Check if liability signals exist
    if (!currentLiabilitySignalsData || !currentLiabilitySignalsData.signals || currentLiabilitySignalsData.signals.length === 0) {
        showError('Please analyze liability signals first before getting liability recommendation.');
        return;
    }
    
    // Show loading state
    loading.style.display = 'block';
    error.style.display = 'none';
    
    // Prepare facts and signals data to send
    const factsData = currentFactsData.facts;
    const signalsData = currentLiabilitySignalsData.signals;
    
    // Send to backend
    fetch('/get-liability-recommendation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ facts: factsData, signals: signalsData })
    })
    .then(response => response.json())
    .then(data => {
        loading.style.display = 'none';
        
        if (data.error) {
            showError(data.error);
        } else if (data.claimant_liability_percent !== undefined && data.other_driver_liability_percent !== undefined) {
            // Store recommendation data
            currentLiabilityRecommendationData = data;
            updateStepIndicators();
            updateProgress();
            // Display liability recommendation
            displayLiabilityRecommendation(data);
        } else {
            showError('No recommendation received from server.');
        }
    })
    .catch(err => {
        loading.style.display = 'none';
        showError('Failed to get liability recommendation. Please try again.');
        console.error('Error:', err);
    });
}

function displayLiabilityRecommendation(recommendationData, skipTabSwitch = false) {
    // Switch to Liability Recommendation tab only if not skipping
    if (!skipTabSwitch) {
        switchTab('liability-recommendation');
    }
    
    // Hide empty state, show form
    const emptyState = document.getElementById('recommendationEmptyState');
    const form = document.getElementById('recommendationForm');
    
    if (emptyState) emptyState.style.display = 'none';
    if (form) form.style.display = 'block';
    
    // Populate form fields
    const claimantPercentInput = document.getElementById('claimantLiabilityPercent');
    const otherDriverPercentInput = document.getElementById('otherDriverLiabilityPercent');
    const explanationTextarea = document.getElementById('recommendationExplanation');
    const keyFactorsList = document.getElementById('keyFactorsList');
    const confidenceFill = document.getElementById('confidenceFill');
    const confidenceText = document.getElementById('confidenceText');
    
    if (claimantPercentInput) {
        claimantPercentInput.value = recommendationData.claimant_liability_percent || 0;
    }
    
    if (otherDriverPercentInput) {
        otherDriverPercentInput.value = recommendationData.other_driver_liability_percent || 0;
    }
    
    if (explanationTextarea) {
        explanationTextarea.value = recommendationData.explanation || '';
    }
    
    // Render key factors
    if (keyFactorsList) {
        keyFactorsList.innerHTML = '';
        const keyFactors = recommendationData.key_factors || [];
        if (keyFactors.length > 0) {
            keyFactors.forEach(factor => {
                const li = document.createElement('li');
                li.textContent = factor;
                keyFactorsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No key factors identified.';
            li.style.color = '#999';
            keyFactorsList.appendChild(li);
        }
    }
    
    // Update confidence display
    const confidence = recommendationData.confidence || 0;
    const confidencePercent = Math.round(confidence * 100);
    if (confidenceFill) {
        confidenceFill.style.width = confidencePercent + '%';
    }
    if (confidenceText) {
        confidenceText.textContent = confidencePercent + '%';
    }
    
    // Scroll to top of tab
    document.getElementById('liabilityRecommendationTab').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateLiabilityPercentages() {
    const claimantPercentInput = document.getElementById('claimantLiabilityPercent');
    const otherDriverPercentInput = document.getElementById('otherDriverLiabilityPercent');
    
    if (!claimantPercentInput || !otherDriverPercentInput) return;
    
    let claimantPercent = parseInt(claimantPercentInput.value) || 0;
    let otherDriverPercent = parseInt(otherDriverPercentInput.value) || 0;
    
    // Ensure values are within valid range
    claimantPercent = Math.max(0, Math.min(100, claimantPercent));
    otherDriverPercent = Math.max(0, Math.min(100, otherDriverPercent));
    
    // Normalize to sum to 100
    const total = claimantPercent + otherDriverPercent;
    if (total !== 100 && total > 0) {
        claimantPercent = Math.round((claimantPercent / total) * 100);
        otherDriverPercent = 100 - claimantPercent;
    } else if (total === 0) {
        claimantPercent = 50;
        otherDriverPercent = 50;
    }
    
    // Update input values
    claimantPercentInput.value = claimantPercent;
    otherDriverPercentInput.value = otherDriverPercent;
}

function updateLiabilityRecommendation() {
    if (!currentLiabilityRecommendationData) {
        showError('No recommendation data to update.');
        return;
    }
    
    const claimantPercentInput = document.getElementById('claimantLiabilityPercent');
    const otherDriverPercentInput = document.getElementById('otherDriverLiabilityPercent');
    const explanationTextarea = document.getElementById('recommendationExplanation');
    
    if (!claimantPercentInput || !otherDriverPercentInput || !explanationTextarea) {
        showError('Form fields not found.');
        return;
    }
    
    // Update stored data with edited values
    currentLiabilityRecommendationData.claimant_liability_percent = parseInt(claimantPercentInput.value) || 0;
    currentLiabilityRecommendationData.other_driver_liability_percent = parseInt(otherDriverPercentInput.value) || 0;
    currentLiabilityRecommendationData.explanation = explanationTextarea.value || '';
    
    showSuccess('Liability recommendation updated successfully!');
}

function generateTimeline() {
    // Check if Step 1 is complete
    if (!checkStep1Completion()) {
        showError('Please complete Step 1 (Fact Analysis) before generating timeline.');
        return;
    }
    
    // Check if fact matrix exists
    if (!currentFactsData || !currentFactsData.facts || currentFactsData.facts.length === 0) {
        showError('Please extract facts first before generating timeline.');
        return;
    }
    
    // Check if liability signals exist
    if (!currentLiabilitySignalsData || !currentLiabilitySignalsData.signals || currentLiabilitySignalsData.signals.length === 0) {
        showError('Please analyze liability signals first before generating timeline.');
        return;
    }
    
    // Switch to Timeline tab
    switchTab('timeline');
    
    // Show loading state in Timeline tab
    showTabLoading('timeline', 'Generating timeline and recommendations...');
    error.style.display = 'none';
    
    // Prepare data to send
    const factsData = currentFactsData.facts;
    const signalsData = currentLiabilitySignalsData.signals;
    const filesData = Object.values(uploadedFiles);
    
    // Trigger parallel API calls for Step 2
    Promise.all([
        // Timeline
        fetch('/generate-timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facts: factsData })
        }).then(r => r.json()),
        
        // Liability Recommendation
        fetch('/get-liability-recommendation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facts: factsData, signals: signalsData })
        }).then(r => r.json())
    ])
    .then(([timelineData, recommendationData]) => {
        hideTabLoading('timeline');
        
        // Handle timeline
        if (timelineData.error) {
            showError('Timeline generation failed: ' + timelineData.error);
        } else if (timelineData.timeline) {
            currentTimelineData = timelineData;
            updateStepIndicators();
            updateProgress();
            displayTimeline(timelineData);
        }
        
        // Handle liability recommendation
        if (recommendationData.error) {
            console.error('Liability recommendation failed:', recommendationData.error);
        } else if (recommendationData.claimant_liability_percent !== undefined) {
            currentLiabilityRecommendationData = recommendationData;
            updateStepIndicators();
            updateProgress();
            // Don't display or switch tabs - wait for user to navigate to liability recommendation tab
        }
        
        showSuccess('Timeline and recommendations generated successfully!');
    })
    .catch(err => {
        hideTabLoading('timeline');
        showError('Failed to generate timeline and recommendations. Please try again.');
        console.error('Error:', err);
    });
}

function displayTimeline(timelineData) {
    // Switch to Timeline tab, but skip loading from localStorage since we're displaying a newly generated timeline
    switchTab('timeline', true);
    
    // Show timeline container
    const timelineContainer = document.getElementById('timelineEventsContainer');
    const saveButton = document.getElementById('saveTimelineButton');
    
    if (timelineContainer) timelineContainer.style.display = 'block';
    if (saveButton) saveButton.style.display = 'inline-flex';
    
    // Render timeline events
    renderTimelineEvents(timelineData.timeline);
    
    // Scroll to top of tab
    document.getElementById('timelineTab').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTimelineEvents(timeline) {
    const timelineList = document.getElementById('timelineEventsList');
    if (!timelineList) return;
    
    timelineList.innerHTML = '';
    
    if (!timeline || timeline.length === 0) {
        timelineList.innerHTML = '<li class="empty-timeline">No events in timeline.</li>';
        return;
    }
    
    timeline.forEach((event, index) => {
        const eventItem = renderTimelineEvent(event, index);
        timelineList.appendChild(eventItem);
    });
}

function renderTimelineEvent(event, index) {
    const li = document.createElement('li');
    li.className = 'timeline-event';
    li.dataset.index = index;
    
    const eventNumber = event.event_number || (index + 1);
    const description = event.description || '';
    const timestamp = event.timestamp || '';
    const supportingFacts = event.supporting_facts || [];
    
    li.innerHTML = `
        <div class="event-header">
            <span class="event-number">Event ${eventNumber}</span>
            ${timestamp ? `<span class="event-timestamp">${escapeHtml(timestamp)}</span>` : ''}
            <div class="event-controls">
                <button class="event-control-btn" onclick="reorderEvent(${index}, 'up')" ${index === 0 ? 'disabled' : ''} title="Move up">↑</button>
                <button class="event-control-btn" onclick="reorderEvent(${index}, 'down')" ${index === (currentTimelineData?.timeline?.length - 1 || 0) ? 'disabled' : ''} title="Move down">↓</button>
            </div>
        </div>
        <div class="event-description-container">
            <textarea class="event-description" rows="3" onchange="updateEventDescription(${index}, this.value)">${escapeHtml(description)}</textarea>
        </div>
        ${supportingFacts.length > 0 ? `
            <div class="supporting-facts">
                <button class="supporting-facts-toggle" onclick="toggleSupportingFacts(${index})">
                    <span class="toggle-icon">▼</span>
                    <span>Supporting Facts (${supportingFacts.length})</span>
                </button>
                <div class="supporting-facts-content" style="display: none;">
                    <ul class="supporting-facts-list">
                        ${supportingFacts.map(fact => {
                            // Parse fact number from format "Fact 1", "Fact 5", etc.
                            const factMatch = fact.match(/Fact\s+(\d+)/i);
                            if (factMatch) {
                                const factIndex = parseInt(factMatch[1]) - 1; // Convert to 0-based index
                                return `<li><a href="#" onclick="scrollToFact(${factIndex}); return false;" class="fact-link" style="color: #667eea; text-decoration: underline; cursor: pointer;">${escapeHtml(fact)}</a></li>`;
                            } else {
                                // Backward compatibility: show as plain text if not in "Fact X" format
                                return `<li>${escapeHtml(fact)}</li>`;
                            }
                        }).join('')}
                    </ul>
                </div>
            </div>
        ` : ''}
    `;
    
    return li;
}

function updateEventDescription(index, newDescription) {
    if (!currentTimelineData || !currentTimelineData.timeline) {
        return;
    }
    
    if (index >= 0 && index < currentTimelineData.timeline.length) {
        currentTimelineData.timeline[index].description = newDescription;
        currentTimelineData.timeline[index].edited = true;
    }
}

function reorderEvent(index, direction) {
    if (!currentTimelineData || !currentTimelineData.timeline) {
        return;
    }
    
    const timeline = currentTimelineData.timeline;
    if (index < 0 || index >= timeline.length) {
        return;
    }
    
    let newIndex;
    if (direction === 'up' && index > 0) {
        newIndex = index - 1;
    } else if (direction === 'down' && index < timeline.length - 1) {
        newIndex = index + 1;
    } else {
        return;
    }
    
    // Swap events
    [timeline[index], timeline[newIndex]] = [timeline[newIndex], timeline[index]];
    
    // Update event numbers
    timeline.forEach((event, idx) => {
        event.event_number = idx + 1;
    });
    
    // Re-render timeline
    renderTimelineEvents(timeline);
}

function toggleSupportingFacts(index) {
    const eventItem = document.querySelector(`.timeline-event[data-index="${index}"]`);
    if (!eventItem) return;
    
    const content = eventItem.querySelector('.supporting-facts-content');
    const toggleIcon = eventItem.querySelector('.toggle-icon');
    
    if (content && toggleIcon) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleIcon.textContent = '▲';
        } else {
            content.style.display = 'none';
            toggleIcon.textContent = '▼';
        }
    }
}

function scrollToFact(factIndex) {
    // Switch to fact matrix tab
    switchTab('fact-matrix');
    
    // Wait for tab to be visible, then scroll to the fact
    setTimeout(() => {
        const factRow = document.querySelector(`tr[data-index="${factIndex}"]`);
        if (factRow) {
            // Highlight the row temporarily
            factRow.style.backgroundColor = '#fff3cd';
            factRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
                factRow.style.backgroundColor = '';
            }, 2000);
        } else {
            showError(`Fact ${factIndex + 1} not found in fact matrix.`);
        }
    }, 100);
}

function saveTimeline() {
    if (!currentTimelineData) {
        showError('No timeline data to save.');
        return;
    }
    
    try {
        localStorage.setItem('timeline_reconstruction', JSON.stringify(currentTimelineData));
        showSuccess('Timeline saved successfully!');
    } catch (err) {
        showError('Failed to save timeline. Please try again.');
        console.error('Error saving timeline:', err);
    }
}

function loadTimeline() {
    try {
        // First check if timeline exists in memory
        if (currentTimelineData && currentTimelineData.timeline) {
            displayTimeline(currentTimelineData);
            return;
        }
        
        // Then check localStorage
        const savedTimeline = localStorage.getItem('timeline_reconstruction');
        if (savedTimeline) {
            const timelineData = JSON.parse(savedTimeline);
            currentTimelineData = timelineData;
            updateStepIndicators();
            updateProgress();
            displayTimeline(timelineData);
        } else {
            // No timeline exists - show empty state
            showTimelineEmptyState();
        }
    } catch (err) {
        console.error('Error loading timeline:', err);
        showTimelineEmptyState();
    }
}

function showTimelineEmptyState() {
    const timelineContainer = document.getElementById('timelineEventsContainer');
    const saveButton = document.getElementById('saveTimelineButton');
    const loadingDiv = document.getElementById('timelineLoading');
    
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (timelineContainer) timelineContainer.style.display = 'none';
    if (saveButton) saveButton.style.display = 'none';
}

function generateClaimRationale() {
    // Check if fact matrix exists
    if (!currentFactsData || !currentFactsData.facts || currentFactsData.facts.length === 0) {
        showError('Please extract facts first before generating claim rationale.');
        return;
    }
    
    // Check if liability signals exist
    if (!currentLiabilitySignalsData || !currentLiabilitySignalsData.signals || currentLiabilitySignalsData.signals.length === 0) {
        showError('Please analyze liability signals first before generating claim rationale.');
        return;
    }
    
    // Switch to claim rationale tab to show loading indicator
    switchTab('claim-rationale');
    
    // Show loading state
    showTabLoading('claimRationale', 'Generating claim rationale...');
    error.style.display = 'none';
    
    // Hide empty state and rationale display while loading
    const emptyState = document.getElementById('rationaleEmptyState');
    const display = document.getElementById('rationaleDisplay');
    if (emptyState) emptyState.style.display = 'none';
    if (display) display.style.display = 'none';
    
    // Prepare facts, signals, and files data to send
    const factsData = currentFactsData.facts;
    const signalsData = currentLiabilitySignalsData.signals;
    const filesData = Object.values(uploadedFiles);
    
    // Send to backend
    fetch('/generate-claim-rationale', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ facts: factsData, signals: signalsData, files: filesData })
    })
    .then(response => response.json())
    .then(data => {
        hideTabLoading('claimRationale');
        
        if (data.error) {
            showError(data.error);
        } else if (data.rationale) {
            // Store rationale data
            currentClaimRationaleData = data;
            updateStepIndicators();
            updateProgress();
            // Display rationale
            displayClaimRationale(data.rationale);
        } else {
            showError('No rationale received from server.');
        }
    })
    .catch(err => {
        hideTabLoading('claimRationale');
        showError('Failed to generate claim rationale. Please try again.');
        console.error('Error:', err);
    });
}

function displayClaimRationale(rationale) {
    // Switch to Claim Rationale tab
    switchTab('claim-rationale');
    
    // Hide empty state, show display
    const emptyState = document.getElementById('rationaleEmptyState');
    const display = document.getElementById('rationaleDisplay');
    
    if (emptyState) emptyState.style.display = 'none';
    if (display) display.style.display = 'block';
    
    // Show action buttons
    const editButton = document.getElementById('editRationaleButton');
    const supervisorButton = document.getElementById('supervisorEscalationButton');
    const downloadButton = document.getElementById('downloadRationaleButton');
    if (editButton) editButton.style.display = 'inline-block';
    if (supervisorButton) supervisorButton.style.display = 'inline-block';
    if (downloadButton) downloadButton.style.display = 'inline-block';
    
    // Update supervisor button state
    updateSupervisorEscalationButton();
    
    // Render rationale
    renderClaimRationale(rationale);
    
    // Scroll to top of tab
    document.getElementById('claimRationaleTab').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderClaimRationale(rationale) {
    const display = document.getElementById('rationaleDisplay');
    if (!display) return;
    
    let html = '<div class="rationale-sections">';
    
    // Incident Summary
    if (rationale.incident_summary) {
        html += `
            <div class="rationale-section">
                <h3>Incident Summary</h3>
                <div class="rationale-content">${escapeHtml(rationale.incident_summary).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }
    
    // Evidence Overview
    if (rationale.evidence_overview) {
        html += `
            <div class="rationale-section">
                <h3>Evidence Overview</h3>
                <div class="rationale-content">
                    ${rationale.evidence_overview.narratives ? `
                        <div class="evidence-subsection">
                            <strong>Narratives:</strong>
                            <p>${escapeHtml(rationale.evidence_overview.narratives).replace(/\n/g, '<br>')}</p>
                        </div>
                    ` : ''}
                    ${rationale.evidence_overview.photos ? `
                        <div class="evidence-subsection">
                            <strong>Photos:</strong>
                            <p>${escapeHtml(rationale.evidence_overview.photos).replace(/\n/g, '<br>')}</p>
                        </div>
                    ` : ''}
                    ${rationale.images && rationale.images.length > 0 ? `
                        <div class="evidence-subsection">
                            <strong>Uploaded Images:</strong>
                            <div class="rationale-images-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                                ${rationale.images.map((img, imgIndex) => {
                                    const sourceLabel = img.type === 'pdf_image' 
                                        ? `${escapeHtml(img.source)} - Page ${img.page}`
                                        : escapeHtml(img.source);
                                    return `
                                        <div class="rationale-image-item" style="border: 1px solid #ddd; border-radius: 5px; padding: 10px; background: #f9f9f9;">
                                            <img src="${img.data}" alt="Evidence image ${imgIndex + 1}" 
                                                 style="width: 100%; height: auto; border-radius: 3px; cursor: pointer;"
                                                 onclick="window.open('${img.data}', '_blank')"
                                                 onerror="this.style.display='none'">
                                            <div style="margin-top: 8px; font-size: 12px; color: #666; text-align: center;">
                                                ${sourceLabel}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // Liability Assessment Logic
    if (rationale.liability_assessment_logic) {
        html += `
            <div class="rationale-section">
                <h3>Liability Assessment Logic</h3>
                <div class="rationale-content">${escapeHtml(rationale.liability_assessment_logic).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }
    
    // Key Evidence
    if (rationale.key_evidence && rationale.key_evidence.length > 0) {
        html += `
            <div class="rationale-section">
                <h3>Key Evidence Supporting Assessment</h3>
                <ul class="rationale-list">
                    ${rationale.key_evidence.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Open Questions
    if (rationale.open_questions && rationale.open_questions.length > 0) {
        html += `
            <div class="rationale-section">
                <h3>Open Questions / Follow-Up</h3>
                <ul class="rationale-list">
                    ${rationale.open_questions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Coverage Considerations
    if (rationale.coverage_considerations) {
        html += `
            <div class="rationale-section">
                <h3>Coverage Considerations</h3>
                <div class="rationale-content">${escapeHtml(rationale.coverage_considerations).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }
    
    // Recommendation
    if (rationale.recommendation) {
        html += `
            <div class="rationale-section">
                <h3>Recommendation</h3>
                <div class="rationale-content recommendation-highlight">${escapeHtml(rationale.recommendation).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }
    
    html += '</div>';
    display.innerHTML = html;
}

let isEditMode = false;
let originalRationaleData = null;

function toggleEditRationale() {
    if (!currentClaimRationaleData || !currentClaimRationaleData.rationale) {
        showError('No claim rationale available to edit.');
        return;
    }
    
    isEditMode = true;
    originalRationaleData = JSON.parse(JSON.stringify(currentClaimRationaleData.rationale));
    
    // Hide display, show edit form
    const display = document.getElementById('rationaleDisplay');
    const editForm = document.getElementById('rationaleEdit');
    const editButton = document.getElementById('editRationaleButton');
    const saveButton = document.getElementById('saveRationaleButton');
    const cancelButton = document.getElementById('cancelEditRationaleButton');
    const downloadButton = document.getElementById('downloadRationaleButton');
    const supervisorButton = document.getElementById('supervisorEscalationButton');
    
    if (display) display.style.display = 'none';
    if (editForm) {
        editForm.style.display = 'block';
        renderEditableRationale(currentClaimRationaleData.rationale);
    }
    if (editButton) editButton.style.display = 'none';
    if (saveButton) saveButton.style.display = 'inline-block';
    if (cancelButton) cancelButton.style.display = 'inline-block';
    if (downloadButton) downloadButton.style.display = 'none';
    if (supervisorButton) supervisorButton.style.display = 'none';
}

function cancelEditRationale() {
    isEditMode = false;
    
    // Restore original data
    if (originalRationaleData && currentClaimRationaleData) {
        currentClaimRationaleData.rationale = JSON.parse(JSON.stringify(originalRationaleData));
    }
    
    // Hide edit form, show display
    const display = document.getElementById('rationaleDisplay');
    const editForm = document.getElementById('rationaleEdit');
    const editButton = document.getElementById('editRationaleButton');
    const saveButton = document.getElementById('saveRationaleButton');
    const cancelButton = document.getElementById('cancelEditRationaleButton');
    const downloadButton = document.getElementById('downloadRationaleButton');
    const supervisorButton = document.getElementById('supervisorEscalationButton');
    
    if (editForm) editForm.style.display = 'none';
    if (display) {
        display.style.display = 'block';
        renderClaimRationale(currentClaimRationaleData.rationale);
    }
    if (editButton) editButton.style.display = 'inline-block';
    if (saveButton) saveButton.style.display = 'none';
    if (cancelButton) cancelButton.style.display = 'none';
    if (downloadButton) downloadButton.style.display = 'inline-block';
    if (supervisorButton) supervisorButton.style.display = 'inline-block';
    
    originalRationaleData = null;
}

function renderEditableRationale(rationale) {
    const editForm = document.getElementById('rationaleEdit');
    if (!editForm) return;
    
    let html = '<div class="rationale-edit-form">';
    
    // Incident Summary
    html += `
        <div class="rationale-edit-section">
            <label for="edit-incident-summary"><strong>Incident Summary</strong></label>
            <textarea id="edit-incident-summary" class="rationale-textarea" rows="5">${escapeHtml(rationale.incident_summary || '')}</textarea>
        </div>
    `;
    
    // Evidence Overview
    html += `
        <div class="rationale-edit-section">
            <label><strong>Evidence Overview</strong></label>
            <div class="evidence-edit-subsection">
                <label for="edit-evidence-narratives">Narratives:</label>
                <textarea id="edit-evidence-narratives" class="rationale-textarea" rows="4">${escapeHtml(rationale.evidence_overview?.narratives || '')}</textarea>
            </div>
            <div class="evidence-edit-subsection">
                <label for="edit-evidence-photos">Photos:</label>
                <textarea id="edit-evidence-photos" class="rationale-textarea" rows="4">${escapeHtml(rationale.evidence_overview?.photos || '')}</textarea>
            </div>
            ${rationale.images && rationale.images.length > 0 ? `
                <div class="evidence-edit-subsection">
                    <strong>Uploaded Images:</strong>
                    <div class="rationale-images-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                        ${rationale.images.map((img, imgIndex) => {
                            const sourceLabel = img.type === 'pdf_image' 
                                ? `${escapeHtml(img.source)} - Page ${img.page}`
                                : escapeHtml(img.source);
                            return `
                                <div class="rationale-image-item" style="border: 1px solid #ddd; border-radius: 5px; padding: 10px; background: #f9f9f9;">
                                    <img src="${img.data}" alt="Evidence image ${imgIndex + 1}" 
                                         style="width: 100%; height: auto; border-radius: 3px; cursor: pointer;"
                                         onclick="window.open('${img.data}', '_blank')"
                                         onerror="this.style.display='none'">
                                    <div style="margin-top: 8px; font-size: 12px; color: #666; text-align: center;">
                                        ${sourceLabel}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Liability Assessment Logic
    html += `
        <div class="rationale-edit-section">
            <label for="edit-liability-logic"><strong>Liability Assessment Logic</strong></label>
            <textarea id="edit-liability-logic" class="rationale-textarea" rows="8">${escapeHtml(rationale.liability_assessment_logic || '')}</textarea>
        </div>
    `;
    
    // Key Evidence
    html += `
        <div class="rationale-edit-section">
            <label for="edit-key-evidence"><strong>Key Evidence Supporting Assessment</strong></label>
            <textarea id="edit-key-evidence" class="rationale-textarea" rows="6" placeholder="Enter each evidence item on a new line">${rationale.key_evidence ? rationale.key_evidence.map(item => escapeHtml(item)).join('\n') : ''}</textarea>
        </div>
    `;
    
    // Open Questions
    html += `
        <div class="rationale-edit-section">
            <label for="edit-open-questions"><strong>Open Questions / Follow-Up</strong></label>
            <textarea id="edit-open-questions" class="rationale-textarea" rows="6" placeholder="Enter each question on a new line">${rationale.open_questions ? rationale.open_questions.map(item => escapeHtml(item)).join('\n') : ''}</textarea>
        </div>
    `;
    
    // Coverage Considerations
    html += `
        <div class="rationale-edit-section">
            <label for="edit-coverage"><strong>Coverage Considerations</strong></label>
            <textarea id="edit-coverage" class="rationale-textarea" rows="6">${escapeHtml(rationale.coverage_considerations || '')}</textarea>
        </div>
    `;
    
    // Recommendation
    html += `
        <div class="rationale-edit-section">
            <label for="edit-recommendation"><strong>Recommendation</strong></label>
            <textarea id="edit-recommendation" class="rationale-textarea" rows="6">${escapeHtml(rationale.recommendation || '')}</textarea>
        </div>
    `;
    
    html += '</div>';
    editForm.innerHTML = html;
}

function saveEditedRationale() {
    if (!currentClaimRationaleData || !currentClaimRationaleData.rationale) {
        showError('No claim rationale available to save.');
        return;
    }
    
    // Collect edited values
    const editedRationale = {
        incident_summary: document.getElementById('edit-incident-summary')?.value || '',
        evidence_overview: {
            narratives: document.getElementById('edit-evidence-narratives')?.value || '',
            photos: document.getElementById('edit-evidence-photos')?.value || ''
        },
        liability_assessment_logic: document.getElementById('edit-liability-logic')?.value || '',
        key_evidence: document.getElementById('edit-key-evidence')?.value.split('\n').filter(line => line.trim()).map(line => line.trim()) || [],
        open_questions: document.getElementById('edit-open-questions')?.value.split('\n').filter(line => line.trim()).map(line => line.trim()) || [],
        coverage_considerations: document.getElementById('edit-coverage')?.value || '',
        recommendation: document.getElementById('edit-recommendation')?.value || ''
    };
    
    // Preserve images if they exist
    if (currentClaimRationaleData.rationale.images) {
        editedRationale.images = currentClaimRationaleData.rationale.images;
    }
    
    // Show loading state
    const saveButton = document.getElementById('saveRationaleButton');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }
    
    // Send to backend to save
    fetch('/save-claim-rationale', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rationale: editedRationale })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update current data
            currentClaimRationaleData.rationale = editedRationale;
            
            // Exit edit mode
            isEditMode = false;
            originalRationaleData = null;
            
            // Hide edit form, show display
            const display = document.getElementById('rationaleDisplay');
            const editForm = document.getElementById('rationaleEdit');
            const editButton = document.getElementById('editRationaleButton');
            const saveButton = document.getElementById('saveRationaleButton');
            const cancelButton = document.getElementById('cancelEditRationaleButton');
            const downloadButton = document.getElementById('downloadRationaleButton');
            const supervisorButton = document.getElementById('supervisorEscalationButton');
            
            if (editForm) editForm.style.display = 'none';
            if (display) {
                display.style.display = 'block';
                renderClaimRationale(editedRationale);
            }
            if (editButton) editButton.style.display = 'inline-block';
            if (saveButton) {
                saveButton.style.display = 'none';
                saveButton.disabled = false;
                saveButton.textContent = 'Save';
            }
            if (cancelButton) cancelButton.style.display = 'none';
            if (downloadButton) downloadButton.style.display = 'inline-block';
            if (supervisorButton) supervisorButton.style.display = 'inline-block';
            
            showSuccessToast('Rationale saved successfully.');
        } else {
            throw new Error(data.error || 'Failed to save rationale');
        }
    })
    .catch(err => {
        showError(err.message || 'Failed to save rationale. Please try again.');
        console.error('Save Rationale Error:', err);
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
        }
    });
}

function updateSupervisorEscalationButton() {
    const supervisorButton = document.getElementById('supervisorEscalationButton');
    if (!supervisorButton) return;
    
    if (isEscalatedToSupervisor) {
        supervisorButton.disabled = true;
        supervisorButton.textContent = 'Escalated to Supervisor';
        // Remove inline styles to let CSS handle disabled state
        supervisorButton.style.opacity = '';
        supervisorButton.style.cursor = '';
    } else {
        supervisorButton.disabled = false;
        supervisorButton.textContent = 'Supervisor Escalation';
        // Remove inline styles to let CSS handle normal state
        supervisorButton.style.opacity = '';
        supervisorButton.style.cursor = '';
    }
}

function openSupervisorEscalationModal() {
    if (isEscalatedToSupervisor) {
        return; // Don't open if already escalated
    }
    
    const modal = document.getElementById('supervisorEscalationModal');
    const modalBody = document.getElementById('supervisorEscalationModalBody');
    const modalContent = document.getElementById('escalationModalContent');
    const modalLoading = document.getElementById('escalationModalLoading');
    const modalActions = document.getElementById('supervisorEscalationModalActions');
    
    if (!modal || !modalBody) {
        showError('Modal elements not found.');
        return;
    }
    
    // Show modal
    modal.style.display = 'block';
    modalLoading.style.display = 'block';
    modalContent.style.display = 'none';
    modalActions.style.display = 'none';
    
    // Check if we already have escalation package data
    if (currentEscalationPackageData && currentEscalationPackageData.escalation_package) {
        // Use existing data
        displayEscalationPackageInModal(currentEscalationPackageData.escalation_package);
    } else {
        // Generate new escalation package
        generateEscalationPackageForModal();
    }
}

function generateEscalationPackageForModal() {
    // Check if fact matrix exists
    if (!currentFactsData || !currentFactsData.facts || currentFactsData.facts.length === 0) {
        showError('Please extract facts first before generating escalation package.');
        closeSupervisorEscalationModal();
        return;
    }
    
    // Check if liability signals exist
    if (!currentLiabilitySignalsData || !currentLiabilitySignalsData.signals || currentLiabilitySignalsData.signals.length === 0) {
        showError('Please analyze liability signals first before generating escalation package.');
        closeSupervisorEscalationModal();
        return;
    }
    
    // Prepare facts and signals data to send
    const factsData = currentFactsData.facts;
    const signalsData = currentLiabilitySignalsData.signals;
    
    // Send to backend
    fetch('/generate-escalation-package', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ facts: factsData, signals: signalsData })
    })
    .then(response => response.json())
    .then(data => {
        const modalLoading = document.getElementById('escalationModalLoading');
        if (modalLoading) modalLoading.style.display = 'none';
        
        if (data.error) {
            showError(data.error);
            closeSupervisorEscalationModal();
        } else if (data.escalation_package) {
            // Store escalation package data
            currentEscalationPackageData = data;
            // Display in modal
            displayEscalationPackageInModal(data.escalation_package);
        } else {
            showError('No escalation package received from server.');
            closeSupervisorEscalationModal();
        }
    })
    .catch(err => {
        const modalLoading = document.getElementById('escalationModalLoading');
        if (modalLoading) modalLoading.style.display = 'none';
        showError('Failed to generate escalation package. Please try again.');
        console.error('Error:', err);
        closeSupervisorEscalationModal();
    });
}

function displayEscalationPackageInModal(escalationPackage) {
    const modalContent = document.getElementById('escalationModalContent');
    const modalActions = document.getElementById('supervisorEscalationModalActions');
    const modalLoading = document.getElementById('escalationModalLoading');
    
    if (!modalContent) return;
    
    if (modalLoading) modalLoading.style.display = 'none';
    modalContent.style.display = 'block';
    if (modalActions) modalActions.style.display = 'flex';
    
    // Render escalation package with editable fields
    let html = '<div class="escalation-sections" style="max-height: 60vh; overflow-y: auto;">';
    
    // Executive Summary (editable)
    if (escalationPackage.executive_summary) {
        html += `
            <div class="escalation-section executive-summary-section">
                <h3>Executive Summary</h3>
                <textarea id="escalationExecutiveSummary" class="escalation-editable" rows="6" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">${escapeHtml(escalationPackage.executive_summary)}</textarea>
            </div>
        `;
    }
    
    // Top 5 Risks (editable)
    if (escalationPackage.top_5_risks && escalationPackage.top_5_risks.length > 0) {
        html += `
            <div class="escalation-section">
                <h3>Top 5 Risks</h3>
                <div class="risks-list">
                    ${escalationPackage.top_5_risks.map((risk, index) => {
                        const severityClass = `risk-severity-${risk.severity || 'medium'}`;
                        const severityIcon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
                        return `
                            <div class="risk-item" style="margin-bottom: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
                                <div class="risk-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                    <span class="risk-number" style="font-weight: bold;">${index + 1}.</span>
                                    <span class="risk-severity ${severityClass}">${severityIcon} ${(risk.severity || 'medium').toUpperCase()}</span>
                                </div>
                                <div class="risk-content" style="margin-bottom: 10px;">
                                    <strong>Risk:</strong>
                                    <textarea id="escalationRisk_${index}" class="escalation-editable" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px; margin-top: 5px;">${escapeHtml(risk.risk || 'N/A')}</textarea>
                                </div>
                                ${risk.impact ? `
                                    <div class="risk-impact">
                                        <strong>Impact:</strong>
                                        <textarea id="escalationImpact_${index}" class="escalation-editable" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px; margin-top: 5px;">${escapeHtml(risk.impact)}</textarea>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    // Needed Supervisor Decisions (editable)
    if (escalationPackage.needed_supervisor_decisions && escalationPackage.needed_supervisor_decisions.length > 0) {
        html += `
            <div class="escalation-section">
                <h3>Needed Supervisor Decisions</h3>
                <div id="escalationDecisionsList">
                    ${escalationPackage.needed_supervisor_decisions.map((item, index) => `
                        <div style="margin-bottom: 10px;">
                            <textarea id="escalationDecision_${index}" class="escalation-editable" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">${escapeHtml(item)}</textarea>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Recommended Adjuster Actions (editable)
    if (escalationPackage.recommended_adjuster_actions && escalationPackage.recommended_adjuster_actions.length > 0) {
        html += `
            <div class="escalation-section">
                <h3>Recommended Adjuster Actions</h3>
                <div id="escalationActionsList">
                    ${escalationPackage.recommended_adjuster_actions.map((item, index) => `
                        <div style="margin-bottom: 10px;">
                            <textarea id="escalationAction_${index}" class="escalation-editable" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px;">${escapeHtml(item)}</textarea>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    modalContent.innerHTML = html;
}

function closeSupervisorEscalationModal() {
    const modal = document.getElementById('supervisorEscalationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function sendToSupervisor() {
    // Show success toast
    showSuccessToast('Sent');
    
    // Close modal
    closeSupervisorEscalationModal();
    
    // Mark as escalated and update button
    isEscalatedToSupervisor = true;
    updateSupervisorEscalationButton();
}

function showSuccessToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 15px 25px;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 99999;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        isolation: isolate;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    if (!document.getElementById('toast-animation-style')) {
        style.id = 'toast-animation-style';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function downloadClaimRationalePDF() {
    if (!currentClaimRationaleData || !currentClaimRationaleData.rationale) {
        showError('No claim rationale available to download.');
        return;
    }
    
    console.log('Downloading PDF with rationale data:', currentClaimRationaleData.rationale);
    
    // Send request to backend to generate PDF
    fetch('/download-claim-rationale-pdf', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rationale: currentClaimRationaleData.rationale })
    })
    .then(response => {
        // Check if response is OK
        if (!response.ok) {
            // Try to parse error message from response
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Failed to generate PDF. Please try again.');
            }).catch(() => {
                // If JSON parsing fails, throw generic error
                const genericMessage = response.status >= 500
                    ? 'PDF service is currently unavailable. Please try again later or contact support.'
                    : `Failed to generate PDF: ${response.status} ${response.statusText}`;
                throw new Error(genericMessage);
            });
        }
        // Check if response is actually a PDF
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
            return response.blob();
        } else {
            // If not PDF, try to parse as JSON error
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Server did not return a PDF');
            });
        }
    })
    .then(blob => {
        // Verify blob is not empty
        if (!blob || blob.size === 0) {
            throw new Error('Received empty PDF file');
        }
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'claim_rationale.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(err => {
        showError(err.message || 'Failed to download PDF. Please try again.');
        console.error('PDF Download Error:', err);
    });
}

function triggerBulkUpload() {
    bulkFileInput.click();
}

function handleBulkUpload(files) {
    if (files.length === 0) {
        showError('No files selected.');
        return;
    }
    
    // Show bulk upload progress
    const progressContainer = document.getElementById('bulkUploadProgress');
    const statusDiv = document.getElementById('bulkUploadStatus');
    progressContainer.style.display = 'block';
    
    // Create per-file loading indicators
    const fileStatusMap = {};
    files.forEach((file, index) => {
        fileStatusMap[file.name] = {
            status: 'uploading',
            element: null
        };
    });
    
    // Update status display with per-file indicators
    const updateStatusDisplay = () => {
        const statusMessages = [];
        files.forEach((file, index) => {
            const fileStatus = fileStatusMap[file.name];
            if (fileStatus) {
                if (fileStatus.status === 'uploading') {
                    statusMessages.push(`<div style="display: flex; align-items: center; gap: 8px;"><span class="spinner inline"></span> ${escapeHtml(file.name)} - Uploading...</div>`);
                } else if (fileStatus.status === 'matching') {
                    statusMessages.push(`<div style="display: flex; align-items: center; gap: 8px;"><span class="spinner inline"></span> ${escapeHtml(file.name)} - Matching document type...</div>`);
                } else if (fileStatus.status === 'complete') {
                    statusMessages.push(fileStatus.element || `<div>✓ ${escapeHtml(file.name)}</div>`);
                } else if (fileStatus.status === 'error') {
                    statusMessages.push(fileStatus.element || `<div style="color: red;">❌ ${escapeHtml(file.name)}</div>`);
                }
            }
        });
        statusDiv.innerHTML = `<p>Processing ${files.length} file(s)...</p><div style="max-height: 300px; overflow-y: auto; margin-top: 10px;">${statusMessages.join('')}</div>`;
    };
    
    statusDiv.innerHTML = `<p>Uploading ${files.length} file(s)...</p>`;
    updateStatusDisplay();
    
    // Create FormData with all files
    const formData = new FormData();
    files.forEach((file, index) => {
        formData.append('files', file);
    });
    
    // Show loading state
    loading.style.display = 'block';
    error.style.display = 'none';
    
    // Send to backend
    fetch('/upload-multiple', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        loading.style.display = 'none';
        
        if (data.error) {
            showError(data.error);
            statusDiv.innerHTML = `<p style="color: red;">Upload failed: ${data.error}</p>`;
        } else if (data.results && Array.isArray(data.results)) {
            // Process results
            let successCount = 0;
            let errorCount = 0;
            const statusMessages = [];
            
            data.results.forEach((result, index) => {
                const fileName = result.filename || files[index]?.name || `File ${index + 1}`;
                const fileStatus = fileStatusMap[fileName] || {};
                
                if (result.error) {
                    errorCount++;
                    fileStatus.status = 'error';
                    fileStatus.element = `<div style="color: red;">❌ ${escapeHtml(fileName)}: ${escapeHtml(result.error)}</div>`;
                    statusMessages.push(fileStatus.element);
                } else {
                    successCount++;
                    fileStatus.status = 'complete';
                    
                    // Find matching expected file based on detected type or filename
                    const detectedType = result.detected_source || 'unknown';
                    const isRelevant = result.is_relevant || false;
                    const expectedFile = findExpectedFileForType(detectedType, result.filename);
                    
                    if (expectedFile) {
                        // Store uploaded file data
                        result.expectedFileName = expectedFile.name;
                        result.originalFilename = result.filename;
                        uploadedFiles[expectedFile.name] = result;
                        fileStatus.element = `<div style="color: green;">✓ ${escapeHtml(fileName)} → ${escapeHtml(expectedFile.displayName)} (${detectedType})</div>`;
                        statusMessages.push(fileStatus.element);
                    } else if (isRelevant) {
                        // Store in miscellaneous if relevant but unmatched
                        const key = `misc_${result.filename || `file_${index}`}`;
                        result.expectedFileName = key;
                        result.originalFilename = result.filename;
                        result.is_miscellaneous = true;
                        uploadedFiles[key] = result;
                        fileStatus.element = `<div style="color: orange;">⚠ ${escapeHtml(fileName)} → Miscellaneous (${detectedType})</div>`;
                        statusMessages.push(fileStatus.element);
                    } else {
                        // Store with original filename if no match found and not relevant
                        const key = result.filename || `file_${index}`;
                        result.expectedFileName = key;
                        result.originalFilename = result.filename;
                        uploadedFiles[key] = result;
                        fileStatus.element = `<div style="color: orange;">⚠ ${escapeHtml(fileName)} → No match found (${detectedType})</div>`;
                        statusMessages.push(fileStatus.element);
                    }
                }
            });
            
            // Re-render file list (this will also update button visibility)
            renderFileList();
            updateStepIndicators();
            updateProgress();
            updateNavigationButtons(); // Update next button state
            
            // Show success message
            if (successCount > 0) {
                showSuccess(`Successfully uploaded ${successCount} file(s)!`);
            }
            
            // Hide progress immediately
            progressContainer.style.display = 'none';
            
            // Automatically check evidence completeness after files are uploaded
            if (successCount > 0) {
                // Show loading state for evidence completeness immediately
                const evidenceLoading = document.getElementById('evidenceCompletenessLoading');
                const checksSummary = document.getElementById('checksSummarySection');
                if (evidenceLoading) {
                    evidenceLoading.style.display = 'block';
                }
                if (checksSummary) {
                    checksSummary.style.display = 'none';
                }
                
                setTimeout(() => {
                    checkEvidenceCompleteness();
                }, 500);
            }
        } else {
            showError('Invalid response from server.');
            statusDiv.innerHTML = `<p style="color: red;">Invalid response from server.</p>`;
        }
    })
    .catch(err => {
        loading.style.display = 'none';
        showError(`Failed to upload files. Please try again.`);
        console.error('Error:', err);
        statusDiv.innerHTML = `<p style="color: red;">Upload failed: ${err.message}</p>`;
    });
}

function findExpectedFileForType(detectedType, filename) {
    // Map detected types to expected file names
    const typeMapping = {
        'fnol': 'fnol.pdf',
        'claimant': 'claimant_statement.pdf',
        'other_driver': 'other_driver_statement.pdf',
        'police': 'police_report.pdf',
        'repair_estimate': 'repair_estimate.pdf',
        'policy': 'policy_document.pdf'
    };
    
    // First try to match by detected type
    if (detectedType && detectedType !== 'unknown' && typeMapping[detectedType]) {
        const expectedFileName = typeMapping[detectedType];
        const expectedFile = expectedFiles.find(f => f.name === expectedFileName);
        if (expectedFile && !uploadedFiles[expectedFileName]) {
            return expectedFile;
        }
    }
    
    // If no match by type, try to match by filename keywords
    const filenameLower = (filename || '').toLowerCase();
    for (const expectedFile of expectedFiles) {
        if (uploadedFiles[expectedFile.name]) {
            continue; // Already uploaded
        }
        
        const expectedNameLower = expectedFile.name.toLowerCase();
        const displayNameLower = expectedFile.displayName.toLowerCase();
        
        // Check if filename contains keywords from expected file
        if (filenameLower.includes('fnol') && expectedNameLower.includes('fnol')) {
            return expectedFile;
        }
        if ((filenameLower.includes('claimant') || filenameLower.includes('claimant')) && expectedNameLower.includes('claimant')) {
            return expectedFile;
        }
        if ((filenameLower.includes('other') && filenameLower.includes('driver')) && expectedNameLower.includes('other_driver')) {
            return expectedFile;
        }
        if (filenameLower.includes('police') && expectedNameLower.includes('police')) {
            return expectedFile;
        }
        if ((filenameLower.includes('repair') || filenameLower.includes('estimate')) && expectedNameLower.includes('repair')) {
            return expectedFile;
        }
        if (filenameLower.includes('policy') && expectedNameLower.includes('policy')) {
            return expectedFile;
        }
        if (filenameLower.includes('accident') && filenameLower.includes('image')) {
            return expectedFiles.find(f => f.name === 'accident_images.png');
        }
    }
    
    return null;
}

// Default contacts for email requests
const defaultContacts = [
    { name: 'John Doe', email: 'john.doe@example.com', role: 'Claimant' },
    { name: 'Jane Smith', email: 'jane.smith@example.com', role: 'Other Driver' },
    { name: 'Sarah Johnson', email: 'sarah.johnson@insurance.com', role: 'FNOL Agent' }
];

let availableContacts = [...defaultContacts];

// Email Request Modal Functions
function openEmailRequestModal() {
    const modal = document.getElementById('emailRequestModal');
    if (!modal) return;
    
    // Reset form
    const missingEvidenceList = document.getElementById('missingEvidenceList');
    const contactSelect = document.getElementById('contactSelect');
    const emailDraftTextarea = document.getElementById('emailDraftTextarea');
    const addContactForm = document.getElementById('addContactForm');
    
    // Populate missing evidence checkboxes
    if (missingEvidenceList) {
        missingEvidenceList.innerHTML = '';
        if (currentMissingEvidence && currentMissingEvidence.length > 0) {
            currentMissingEvidence.forEach((evidence, index) => {
                const item = document.createElement('div');
                item.className = 'missing-evidence-item';
                item.innerHTML = `
                    <input type="checkbox" id="evidence_${index}" value="${index}" checked>
                    <label for="evidence_${index}" class="missing-evidence-item-label">
                        <span class="evidence-name">${escapeHtml(evidence.evidence_needed || 'Unknown')}</span>
                    </label>
                `;
                missingEvidenceList.appendChild(item);
            });
        } else {
            missingEvidenceList.innerHTML = '<p style="color: #666; font-size: 0.9em;">No missing evidence items available.</p>';
        }
    }
    
    // Populate contact dropdown
    if (contactSelect) {
        contactSelect.innerHTML = '<option value="">Select a contact...</option>';
        availableContacts.forEach((contact, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${contact.name} (${contact.email}) - ${contact.role}`;
            option.dataset.contact = JSON.stringify(contact);
            contactSelect.appendChild(option);
        });
    }
    
    // Clear email draft
    if (emailDraftTextarea) {
        emailDraftTextarea.value = '';
        emailDraftTextarea.style.display = 'block';
    }
    
    // Ensure loading is hidden and button is visible
    const emailDraftLoading = document.getElementById('emailDraftLoading');
    if (emailDraftLoading) {
        emailDraftLoading.style.display = 'none';
    }
    const generateDraftButton = document.getElementById('generateDraftButton');
    if (generateDraftButton) {
        generateDraftButton.style.display = 'block';
    }
    
    // Hide add contact form
    if (addContactForm) {
        addContactForm.style.display = 'none';
    }
    
    // Show modal
    modal.style.display = 'block';
}

function closeFileViewModal() {
    const modal = document.getElementById('fileViewModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeEmailRequestModal() {
    const modal = document.getElementById('emailRequestModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Reset form
    const emailDraftLoading = document.getElementById('emailDraftLoading');
    if (emailDraftLoading) {
        emailDraftLoading.style.display = 'none';
    }
    const generateDraftButton = document.getElementById('generateDraftButton');
    if (generateDraftButton) {
        generateDraftButton.style.display = 'block';
    }
    const emailDraftTextarea = document.getElementById('emailDraftTextarea');
    if (emailDraftTextarea) {
        emailDraftTextarea.style.display = 'block';
    }
}

function onContactChange() {
    const contactSelect = document.getElementById('contactSelect');
    if (!contactSelect || !contactSelect.value) return;
    
    // Contact changed, could trigger auto-draft generation if needed
    // For now, just clear the draft
    const emailDraftTextarea = document.getElementById('emailDraftTextarea');
    if (emailDraftTextarea) {
        emailDraftTextarea.value = '';
    }
}

function showAddContactForm() {
    const addContactForm = document.getElementById('addContactForm');
    if (addContactForm) {
        addContactForm.style.display = 'block';
    }
}

function hideAddContactForm() {
    const addContactForm = document.getElementById('addContactForm');
    const newContactName = document.getElementById('newContactName');
    const newContactEmail = document.getElementById('newContactEmail');
    const newContactRole = document.getElementById('newContactRole');
    
    if (addContactForm) {
        addContactForm.style.display = 'none';
    }
    
    // Clear form
    if (newContactName) newContactName.value = '';
    if (newContactEmail) newContactEmail.value = '';
    if (newContactRole) newContactRole.value = '';
}

function addContact() {
    const newContactName = document.getElementById('newContactName');
    const newContactEmail = document.getElementById('newContactEmail');
    const newContactRole = document.getElementById('newContactRole');
    const contactSelect = document.getElementById('contactSelect');
    
    if (!newContactName || !newContactEmail) return;
    
    const name = newContactName.value.trim();
    const email = newContactEmail.value.trim();
    const role = newContactRole ? newContactRole.value.trim() : 'Custom';
    
    if (!name || !email) {
        showError('Please provide both name and email.');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please provide a valid email address.');
        return;
    }
    
    // Add contact
    const newContact = { name, email, role: role || 'Custom' };
    availableContacts.push(newContact);
    
    // Add to dropdown
    if (contactSelect) {
        const option = document.createElement('option');
        option.value = availableContacts.length - 1;
        option.textContent = `${newContact.name} (${newContact.email}) - ${newContact.role}`;
        option.dataset.contact = JSON.stringify(newContact);
        option.selected = true;
        contactSelect.appendChild(option);
    }
    
    // Hide form
    hideAddContactForm();
}

function generateEmailDraft() {
    const missingEvidenceList = document.getElementById('missingEvidenceList');
    const contactSelect = document.getElementById('contactSelect');
    const emailDraftTextarea = document.getElementById('emailDraftTextarea');
    const emailDraftLoading = document.getElementById('emailDraftLoading');
    
    if (!missingEvidenceList || !contactSelect || !emailDraftTextarea) return;
    
    // Get selected evidence items
    const selectedCheckboxes = missingEvidenceList.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        showError('Please select at least one missing evidence item.');
        return;
    }
    
    const selectedEvidence = Array.from(selectedCheckboxes).map(cb => {
        const index = parseInt(cb.value);
        return currentMissingEvidence[index];
    });
    
    // Get selected contact
    if (!contactSelect.value) {
        showError('Please select a contact.');
        return;
    }
    
    const contactIndex = parseInt(contactSelect.value);
    const contact = availableContacts[contactIndex];
    
    if (!contact) {
        showError('Invalid contact selected.');
        return;
    }
    
    // Show loading
    if (emailDraftLoading) {
        emailDraftLoading.style.display = 'block';
    }
    emailDraftTextarea.style.display = 'none';
    const generateDraftButton = document.getElementById('generateDraftButton');
    if (generateDraftButton) {
        generateDraftButton.style.display = 'none';
    }
    
    // Prepare request data
    const requestData = {
        selected_evidence: selectedEvidence,
        contact: contact,
        claim_context: '' // Could be enhanced with actual claim context
    };
    
    // Log request details
    console.log('[EMAIL DRAFT] Starting email draft generation');
    console.log('[EMAIL DRAFT] Request URL: /generate-email-draft');
    console.log('[EMAIL DRAFT] Request data:', {
        selected_evidence_count: requestData.selected_evidence.length,
        contact: requestData.contact,
        has_claim_context: !!requestData.claim_context
    });
    
    // Call backend to generate draft
    fetch('/generate-email-draft', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('[EMAIL DRAFT] Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            // Try to parse error message from response
            return response.json().then(data => {
                console.error('[EMAIL DRAFT ERROR] Server error response:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: data.error,
                    full_data: data
                });
                throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
            }).catch(parseError => {
                console.error('[EMAIL DRAFT ERROR] Failed to parse error response:', parseError);
                console.error('[EMAIL DRAFT ERROR] Response status:', response.status, response.statusText);
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('[EMAIL DRAFT] Success response received:', {
            has_draft: !!data.draft,
            draft_length: data.draft ? data.draft.length : 0,
            success: data.success,
            has_error: !!data.error
        });
        
        if (emailDraftLoading) {
            emailDraftLoading.style.display = 'none';
        }
        emailDraftTextarea.style.display = 'block';
        const generateDraftButton = document.getElementById('generateDraftButton');
        if (generateDraftButton) {
            generateDraftButton.style.display = 'block';
        }
        
        if (data.error) {
            console.error('[EMAIL DRAFT ERROR] Error in response data:', data.error);
            showError(data.error);
        } else if (data.draft) {
            console.log('[EMAIL DRAFT] Draft generated successfully');
            emailDraftTextarea.value = data.draft;
        } else {
            console.error('[EMAIL DRAFT ERROR] No draft content in response:', data);
            showError('Failed to generate email draft. No draft content received.');
        }
    })
    .catch(err => {
        console.error('[EMAIL DRAFT ERROR] Fetch error caught:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            error: err
        });
        
        if (emailDraftLoading) {
            emailDraftLoading.style.display = 'none';
        }
        emailDraftTextarea.style.display = 'block';
        const generateDraftButton = document.getElementById('generateDraftButton');
        if (generateDraftButton) {
            generateDraftButton.style.display = 'block';
        }
        const errorMessage = err.message || 'Failed to generate email draft. Please try again.';
        console.error('[EMAIL DRAFT ERROR] Final error message:', errorMessage);
        showError(errorMessage);
    });
}

function sendEmailRequest() {
    const missingEvidenceList = document.getElementById('missingEvidenceList');
    const contactSelect = document.getElementById('contactSelect');
    const emailDraftTextarea = document.getElementById('emailDraftTextarea');
    
    if (!missingEvidenceList || !contactSelect || !emailDraftTextarea) return;
    
    // Get selected evidence items
    const selectedCheckboxes = missingEvidenceList.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        showError('Please select at least one missing evidence item.');
        return;
    }
    
    const selectedEvidence = Array.from(selectedCheckboxes).map(cb => {
        const index = parseInt(cb.value);
        return currentMissingEvidence[index];
    });
    
    // Get selected contact
    if (!contactSelect.value) {
        showError('Please select a contact.');
        return;
    }
    
    const contactIndex = parseInt(contactSelect.value);
    const contact = availableContacts[contactIndex];
    
    if (!contact) {
        showError('Invalid contact selected.');
        return;
    }
    
    // Get email body
    const emailBody = emailDraftTextarea.value.trim();
    if (!emailBody) {
        showError('Please generate or enter an email draft.');
        return;
    }
    
    // Prepare request data
    const requestData = {
        to: contact.email,
        subject: 'Request for Additional Evidence - Auto Insurance Claim',
        body: emailBody,
        selected_evidence: selectedEvidence
    };
    
    // Call backend to send email
    fetch('/send-email-request', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        // Check if response is OK before parsing JSON
        if (!response.ok) {
            // Try to parse error response
            return response.json().then(errorData => {
                throw new Error(errorData.error || `HTTP ${response.status}: Failed to send email`);
            }).catch(() => {
                // If JSON parsing fails, throw with status text
                throw new Error(`HTTP ${response.status}: ${response.statusText || 'Failed to send email'}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            showError(data.error);
        } else if (data.success) {
            // Track sent emails using checkItem keys
            selectedEvidence.forEach(evidence => {
                const evidenceNeeded = evidence.evidence_needed || 'unknown';
                const key = mapEvidenceNeededToKey(evidenceNeeded); // Map to checkItem key
                if (!sentEmails[key]) {
                    sentEmails[key] = [];
                }
                sentEmails[key].push({
                    to: contact.email,
                    to_name: contact.name,
                    sent_at: data.sent_at || new Date().toISOString(),
                    message_id: data.message_id
                });
            });
            
            // Update UI to show email status
            updateEmailStatusIndicators();
            
            // Show success message
            showSuccessMessage(`Email sent successfully to ${contact.name} (${contact.email})`);
            
            // Close modal after a short delay
            setTimeout(() => {
                closeEmailRequestModal();
            }, 1500);
        } else {
            showError('Failed to send email.');
        }
    })
    .catch(err => {
        // Display the actual error message from backend or network error
        const errorMessage = err.message || 'Failed to send email. Please try again.';
        showError(errorMessage);
        console.error('Email send error:', err);
    });
}

function updateEmailStatusIndicators() {
    // Update evidence completeness table to show email status
    const checksTableBody = document.getElementById('checksTableBody');
    if (!checksTableBody) return;
    
    const rows = checksTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        // Remove existing email sent badge to avoid duplicates
        const existingEmailBadge = row.querySelector('.status-email-sent');
        if (existingEmailBadge) {
            existingEmailBadge.remove();
        }
        
        // Get the evidence key from data attribute
        const evidenceKey = row.getAttribute('data-evidence-key');
        if (!evidenceKey) return;
        
        // Check if email was sent for this evidence key
        const emailInfo = sentEmails[evidenceKey];
        const hasEmailSent = emailInfo && emailInfo.length > 0;
        
        // Get the status cell (second column)
        const statusCell = row.querySelector('td:nth-child(2)');
        if (!statusCell) return;
        
        // If email was sent, add an "Email Sent" badge
        if (hasEmailSent) {
            // Get the most recent email
            const latestEmail = emailInfo[emailInfo.length - 1];
            const sentDate = latestEmail.sent_at ? new Date(latestEmail.sent_at).toLocaleDateString() : '';
            const recipientName = latestEmail.to_name || latestEmail.to || 'recipient';
            
            // Create email sent badge
            const emailSentBadge = document.createElement('span');
            emailSentBadge.className = 'check-status status-email-sent';
            emailSentBadge.innerHTML = '📧 Email Sent';
            emailSentBadge.title = `Email sent to ${recipientName}${sentDate ? ` on ${sentDate}` : ''}`;
            
            // Check if status cell already has a container
            let statusContainer = statusCell.querySelector('.status-badge-container');
            if (!statusContainer) {
                // Get existing status badge(s)
                const existingStatuses = statusCell.querySelectorAll('.check-status:not(.status-email-sent)');
                
                if (existingStatuses.length > 0) {
                    // Create container and move existing badges into it
                    statusContainer = document.createElement('div');
                    statusContainer.className = 'status-badge-container';
                    
                    // Insert container before first existing status
                    existingStatuses[0].parentNode.insertBefore(statusContainer, existingStatuses[0]);
                    
                    // Move all existing status badges into container
                    existingStatuses.forEach(status => {
                        statusContainer.appendChild(status);
                    });
                } else {
                    // No existing status badges, just create container
                    statusContainer = document.createElement('div');
                    statusContainer.className = 'status-badge-container';
                    statusCell.appendChild(statusContainer);
                }
            }
            
            // Add email sent badge to container
            statusContainer.appendChild(emailSentBadge);
        }
    });
}

function showSuccessMessage(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 15px 20px; border-radius: 6px; z-index: 99999; box-shadow: 0 4px 12px rgba(0,0,0,0.2); backdrop-filter: none; -webkit-backdrop-filter: none; isolation: isolate;';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Make functions globally accessible
window.triggerFileUpload = triggerFileUpload;
window.triggerBulkUpload = triggerBulkUpload;
window.viewFile = viewFile;
window.viewUnmatchedFile = viewUnmatchedFile;
window.extractFacts = extractFacts;
window.filterFacts = filterFacts;
window.toggleSourceText = toggleSourceText;
window.exportFactsAsJSON = exportFactsAsJSON;
window.switchTab = switchTab;
window.analyzeLiabilitySignals = analyzeLiabilitySignals;
window.toggleEvidenceText = toggleEvidenceText;
window.checkEvidenceCompleteness = checkEvidenceCompleteness;
window.getLiabilityRecommendation = getLiabilityRecommendation;
window.updateLiabilityPercentages = updateLiabilityPercentages;
window.updateLiabilityRecommendation = updateLiabilityRecommendation;
window.generateTimeline = generateTimeline;
window.updateEventDescription = updateEventDescription;
window.reorderEvent = reorderEvent;
window.toggleSupportingFacts = toggleSupportingFacts;
window.saveTimeline = saveTimeline;
window.scrollToFact = scrollToFact;
window.generateClaimRationale = generateClaimRationale;
window.openSupervisorEscalationModal = openSupervisorEscalationModal;
window.closeSupervisorEscalationModal = closeSupervisorEscalationModal;
window.openEmailRequestModal = openEmailRequestModal;
window.closeEmailRequestModal = closeEmailRequestModal;
window.onContactChange = onContactChange;
window.showAddContactForm = showAddContactForm;
window.hideAddContactForm = hideAddContactForm;
window.addContact = addContact;
window.generateEmailDraft = generateEmailDraft;
window.sendEmailRequest = sendEmailRequest;
window.sendToSupervisor = sendToSupervisor;
window.downloadClaimRationalePDF = downloadClaimRationalePDF;
window.acceptConflictVersion = acceptConflictVersion;
window.closeFileViewModal = closeFileViewModal;

