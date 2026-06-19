import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Global setup for Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export type VotingStep = 
  | 'ELECTION_DETAILS'
  | 'VOTER_AUTHENTICATION'
  | 'TOKEN_REQUEST'
  | 'TOKEN_DELIVERY'
  | 'TOKEN_VERIFICATION'
  | 'CANDIDATE_SELECTION'
  | 'VOTE_REVIEW'
  | 'VOTE_SUBMISSION'
  | 'COMPLETION';

export type TokenDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

export interface VotingSession {
  id: string;
  election_id: string;
  voter_id: string;
  current_step: VotingStep;
  delivery_status: TokenDeliveryStatus | null;
  created_at: string;
  updated_at: string;
}

export function useVotingWorkflow(electionId: string, voterId: string) {
  const [currentStep, setCurrentStep] = useState<VotingStep>('ELECTION_DETAILS');
  const [sessionData, setSessionData] = useState<VotingSession | null>(null);
  const [syncing, setSyncing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!electionId || !voterId) return;
    
    setSyncing(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from('voting_sessions')
        .select('*')
        .eq('election_id', electionId)
        .eq('voter_id', voterId)
        .single();

      if (sbError && sbError.code !== 'PGRST116') { // PGRST116 is not found
        throw sbError;
      }

      if (data) {
        setSessionData(data);
        
        // --- State Resumption Logic ---
        let resolvedStep = data.current_step;
        
        if (data.delivery_status === 'FAILED') {
          resolvedStep = 'TOKEN_REQUEST'; // Recovery mode
        } else if (data.delivery_status === 'PENDING') {
          resolvedStep = 'TOKEN_DELIVERY'; // Awaiting delivery
        } else if (data.delivery_status === 'DELIVERED' && data.current_step === 'TOKEN_DELIVERY') {
          // Delivered but not yet verified
          resolvedStep = 'TOKEN_VERIFICATION';
        }
        
        setCurrentStep(resolvedStep);
      } else {
        // No session found, remain on default step
        setCurrentStep('ELECTION_DETAILS');
        setSessionData(null);
      }
    } catch (err: any) {
      console.error('Error syncing voting state:', err);
      setError('Failed to synchronize state with the server.');
    } finally {
      setSyncing(false);
    }
  }, [electionId, voterId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    currentStep,
    sessionData,
    syncing,
    error,
    refreshStatus: fetchSession
  };
}
