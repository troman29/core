import { ELECTIONS_API_URL } from '../../../config';
import { fetchJson } from '../../util/fetch';

type Validator = {
  adnl_addr: string;
  pubkey: string;
  weight: number;
  index: number;
  stake: number;
  max_factor: number;
  wallet_address: string;
  complaints: unknown[];
};

type ValidatorCycle = {
  cycle_id: number;
  cycle_info: {
    utime_since: number;
    utime_until: number;
    total_weight: number;
    validators: Validator[];
    total_stake: number;
    total_participants: number;
  };
  config15: {
    validators_elected_for: number;
    elections_start_before: number;
    elections_end_before: number;
    stake_held_for: number;
  };
  config16: {
    max_validators: number;
    max_main_validators: number;
    min_validators: number;
  };
  config17: {
    min_stake: number;
    max_stake: number;
    max_stake_factor: number;
  };
};

export function fetchValidationCycles(): Promise<ValidatorCycle[]> {
  return fetchJson(`${ELECTIONS_API_URL}/getValidationCycles?limit=2&return_participants=true`);
}
