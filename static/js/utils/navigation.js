/**
 * Navigation and step management utilities.
 */
import { steps, currentStepIndex, setCurrentStepIndex } from '../state.js';
import { uploadedFiles, step1Completion, currentLiabilityRecommendationData, currentTimelineData, currentClaimRationaleData } from '../state.js';

export function isStepCompleted(stepId) {
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

export function isStepAccessible(stepId) {
    const step = steps.find(s => s.id === stepId);
    if (!step) return false;
    
    return step.requires.every(req => isStepCompleted(req));
}

export function goToStep(index) {
    setCurrentStepIndex(index);
}

export function getCurrentStepIndex() {
    return currentStepIndex;
}


