import React from 'react';
import { VotingStep } from '../hooks/useVotingWorkflow';

interface VotingTrackerProps {
  currentStep: VotingStep;
  syncing: boolean;
  onRefresh: () => void;
}

const STEPS: { key: VotingStep; label: string }[] = [
  { key: 'ELECTION_DETAILS', label: 'Election Details' },
  { key: 'VOTER_AUTHENTICATION', label: 'Auth' },
  { key: 'TOKEN_REQUEST', label: 'Request Token' },
  { key: 'TOKEN_DELIVERY', label: 'Token Delivery' },
  { key: 'TOKEN_VERIFICATION', label: 'Verify Token' },
  { key: 'CANDIDATE_SELECTION', label: 'Select Candidates' },
  { key: 'VOTE_REVIEW', label: 'Review Vote' },
  { key: 'VOTE_SUBMISSION', label: 'Submit Vote' },
  { key: 'COMPLETION', label: 'Complete' }
];

export const VotingTracker: React.FC<VotingTrackerProps> = ({ currentStep, syncing, onRefresh }) => {
  const currentIndex = STEPS.findIndex(step => step.key === currentStep);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Voting Progress</h2>
        <button
          onClick={onRefresh}
          disabled={syncing}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-2"
        >
          {syncing && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {syncing ? 'Syncing...' : 'Refresh Status'}
        </button>
      </div>

      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 rounded transition-all duration-500"
          style={{ width: `${(Math.max(0, currentIndex) / (STEPS.length - 1)) * 100}%` }}
        ></div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step.key} className="flex flex-col items-center group">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 z-10 ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg ring-4 ring-blue-100 scale-110'
                        : 'bg-white border-gray-300 text-gray-400 group-hover:border-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span 
                  className={`mt-3 text-xs font-medium text-center w-16 md:w-24 transition-colors duration-300 ${
                    isCurrent ? 'text-blue-600 font-bold' : isCompleted ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
