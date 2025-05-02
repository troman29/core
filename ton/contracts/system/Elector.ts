// eslint-disable-next-line max-classes-per-file
import type { Cell, Contract, ContractProvider, TupleReader } from '@ton/core';
import { Address } from '@ton/core';

import { bigint2buff, buff2bigint, LispList } from './utils';

export class Participant {
  constructor(readonly id: bigint,
    readonly stake: bigint,
    readonly max_factor: number,
    readonly address: Address,
    readonly adnl: bigint) { }
  static fromReader(rdr: TupleReader) {
    const id = rdr.readBigNumber();
    const data = rdr.readTuple();
    return new Participant(id,
      data.readBigNumber(),
      data.readNumber(),
      new Address(-1, bigint2buff(data.readBigNumber())),
      data.readBigNumber());
  }
}

export class Elector implements Contract {
  constructor(readonly address: Address, readonly init?: {
    code: Cell;
    data: Cell;
    special:{ tick:boolean; tock:boolean };
  }) {}

  static createFromAddress(address: Address) {
    return new Elector(address);
  }

  // eslint-disable-next-line class-methods-use-this
  async getActiveElectionId(provider: ContractProvider) {
    const { stack } = await provider.get('active_election_id', []);
    return stack.readNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getStake(provider: ContractProvider, validator_key: Buffer) {
    const { stack } = await provider.get('participates_in', [
      { type: 'int', value: BigInt(`0x${validator_key.toString('hex')}`) },
    ]);
    return stack.readBigNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getReturnedStake(provider: ContractProvider, wallet:Address) {
    const { stack } = await provider.get('compute_returned_stake', [{
      type: 'int', value: buff2bigint(wallet.hash),
    }]);
    return stack.readBigNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getParticipantListExtended(provider: ContractProvider) {
    const { stack } = await provider.get('participant_list_extended', []);
    return {
      elect_at: stack.readNumber(),
      elect_close: stack.readNumber(),
      min_stake: stack.readBigNumber(),
      total_stake: stack.readBigNumber(),
      list: new LispList(stack.readTupleOpt(), Participant).toArray(),
      failed: stack.readBoolean(),
      finished: stack.readBoolean(),
    };
  }
}
