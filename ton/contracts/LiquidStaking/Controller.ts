import type { Address, Cell, Contract, ContractProvider, Sender } from '@ton/core';
import { beginCell, SendMode, toNano } from '@ton/core';

import { Conf, LiquidOpCode } from './constants';

export class Controller implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new Controller(address);
  }

  // eslint-disable-next-line class-methods-use-this
  async sendTopUp(provider: ContractProvider, via: Sender, value:bigint = toNano('2000')) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.controller.top_up, 32) // op = top up
        .storeUint(0, 64) // query id
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendApprove(
    provider: ContractProvider,
    via: Sender,
    approve: boolean = true,
    amount: bigint = toNano('0.1'),
  ) {
    // dissaprove support
    const op = approve ? LiquidOpCode.controller.approve : LiquidOpCode.controller.disapprove;

    await provider.internal(via, {
      value: amount,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(op, 32) // op
        .storeUint(1, 64) // query id
        .endCell(),
    });
  }

  static updateHashMessage(query_id: bigint | number = 0) {
    return beginCell().storeUint(LiquidOpCode.controller.update_validator_hash, 32)
      .storeUint(query_id, 64)
      .endCell();
  }

  // eslint-disable-next-line class-methods-use-this
  async sendUpdateHash(
    provider: ContractProvider,
    via: Sender,
    value: bigint = toNano('1'),
    queryId: bigint | number = 0,
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: Controller.updateHashMessage(queryId),
    });
  }

  static recoverStakeMessage(query_id: bigint | number = 0) {
    return beginCell().storeUint(LiquidOpCode.controller.recover_stake, 32).storeUint(query_id, 64).endCell();
  }

  // eslint-disable-next-line class-methods-use-this
  async sendRecoverStake(
    provider: ContractProvider,
    via: Sender,
    value:bigint = Conf.electorOpValue,
    query_id: bigint | number = 0,
  ) {
    await provider.internal(via, {
      body: Controller.recoverStakeMessage(query_id),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value,
    });
  }

  // Get methods
  // eslint-disable-next-line class-methods-use-this
  async getControllerData(provider: ContractProvider) {
    const { stack } = await provider.get('get_validator_controller_data', []);
    return {
      state: stack.readNumber(),
      halted: stack.readBoolean(),
      approved: stack.readBoolean(),
      stakeSent: stack.readBigNumber(),
      stakeAt: stack.readNumber(),
      validatorSetHash: stack.readBigNumber(),
      validatorSetChangeCount: stack.readNumber(),
      validatorSetChangeTime: stack.readNumber(),
      stakeHeldFor: stack.readNumber(),
      borrowedAmount: stack.readBigNumber(),
      borrowingTime: stack.readNumber(),
      validator: stack.readAddress(),
      pool: stack.readAddress(),
      sudoer: stack.readAddressOpt(),
    };
  }

  async getValidatorAmount(provider: ContractProvider) {
    const res = await this.getControllerData(provider);
    const state = await provider.getState();
    return state.balance - res.borrowedAmount;
  }

  // eslint-disable-next-line class-methods-use-this
  async getMaxPunishment(provider: ContractProvider, stake:bigint) {
    const { stack } = await provider.get('get_max_punishment', [{ type: 'int', value: stake }]);
    return stack.readBigNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getBalanceForLoan(provider: ContractProvider, credit:bigint, interest:bigint | number) {
    const { stack } = await provider.get('required_balance_for_loan', [
      { type: 'int', value: credit },
      { type: 'int', value: BigInt(interest) },
    ]);
    return stack.readBigNumber();
  }

  // eslint-disable-next-line class-methods-use-this
  async getRequestWindow(provider: ContractProvider) {
    const { stack } = await provider.get('request_window_time', []);
    return {
      since: stack.readNumber(),
      until: stack.readNumber(),
    };
  }
}
