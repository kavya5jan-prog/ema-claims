/**
 * Application configuration and constants.
 */

// Predefined list of files to upload
export const expectedFiles = [
    { name: 'accident_images.png', type: 'image', displayName: 'Accident Images' },
    { name: 'fnol.pdf', type: 'pdf', displayName: 'First Notice of Loss' },
    { name: 'claimant_statement.pdf', type: 'pdf', displayName: 'Claimant Statement' },
    { name: 'other_driver_statement.pdf', type: 'pdf', displayName: 'Other Driver Statement' },
    { name: 'police_report.pdf', type: 'pdf', displayName: 'Police Report' },
    { name: 'repair_estimate.pdf', type: 'pdf', displayName: 'Repair Estimate' },
    { name: 'state_negligence_rules.pdf', type: 'pdf', displayName: 'State Negligence Rules' },
    { name: 'policy_document.pdf', type: 'pdf', displayName: 'Policy Document' }
];

// Step definitions in order
export const steps = [
    { id: 'files', name: 'Files', requires: [] },
    { id: 'fact-matrix', name: 'Fact Matrix', requires: ['files'] },
    { id: 'timeline', name: 'Timeline Reconstruction', requires: ['fact-matrix'] },
    { id: 'liability-recommendation', name: 'Liability % Recommendation', requires: ['timeline'] },
    { id: 'claim-rationale', name: 'Draft Claim Rationale', requires: ['fact-matrix'] }
];


