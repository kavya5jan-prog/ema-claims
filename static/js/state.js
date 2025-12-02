/**
 * Global application state management.
 */

// Store uploaded files data (keyed by expected file name)
export const uploadedFiles = {};

// Step 1 completion tracking
export let step1Completion = {
    factsExtracted: false,
    liabilitySignals: false,
    evidenceComplete: false
};

export let currentStepIndex = 0;

// Store current data
export let currentFactsData = null;
export let currentLiabilitySignalsData = null;
export let currentLiabilityRecommendationData = null;
export let currentTimelineData = null;
export let currentClaimRationaleData = null;
export let currentEscalationPackageData = null;
export let isEscalatedToSupervisor = false;

// State setters
export function setStep1Completion(completion) {
    step1Completion = { ...step1Completion, ...completion };
}

export function setCurrentStepIndex(index) {
    currentStepIndex = index;
}

export function setCurrentFactsData(data) {
    currentFactsData = data;
}

export function setCurrentLiabilitySignalsData(data) {
    currentLiabilitySignalsData = data;
}

export function setCurrentLiabilityRecommendationData(data) {
    currentLiabilityRecommendationData = data;
}

export function setCurrentTimelineData(data) {
    currentTimelineData = data;
}

export function setCurrentClaimRationaleData(data) {
    currentClaimRationaleData = data;
}

export function setCurrentEscalationPackageData(data) {
    currentEscalationPackageData = data;
}

export function setIsEscalatedToSupervisor(value) {
    isEscalatedToSupervisor = value;
}


