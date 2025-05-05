import type { Address, Cell, Contract, ContractProvider, DictionaryValue, Message, Sender } from '@ton/core';
import { beginCell, contractAddress, Dictionary, SendMode, storeMessage, toNano, TupleBuilder } from '@ton/core';

import type { PoolState } from './constants';
import { Conf, LiquidOpCode } from './constants';

import { PayoutCollection } from './PayoutNFTCollection';

export type PoolConfig = {
  pool_jetton: Address;
  pool_jetton_supply: bigint;
  optimistic_deposit_withdrawals: bigint;

  sudoer: Address;
  governor: Address;
  interest_manager: Address;
  halter: Address;
  approver: Address;

  controller_code: Cell;
  payout_wallet_code?: Cell;
  pool_jetton_wallet_code: Cell;
  payout_minter_code: Cell;
  vote_keeper_code: Cell;
};

type RoundData = {
  borrowers: Cell | null; roundId: number;
  activeBorrowers: bigint; borrowed: bigint;
  expected: bigint; returned: bigint;
  profit: bigint;
};

type State = typeof PoolState.NORMAL | typeof PoolState.REPAYMENT_ONLY;

export type PoolFullConfig = {
  state: State;
  halted: boolean;
  totalBalance: bigint;
  poolJetton: Address;
  poolJettonSupply: bigint;
  depositMinter: Address | null;
  requestedForDeposit: bigint | null;
  withdrawalMinter: Address | null;
  requestedForWithdrawal: bigint | null;
  interestRate: number;
  optimisticDepositWithdrawals: boolean;
  depositsOpen: boolean;
  savedValidatorSetHash: bigint;
  currentRound: RoundData;
  prevRound: RoundData;

  minLoanPerValidator: bigint;
  maxLoanPerValidator: bigint;

  governanceFee: number;

  sudoer: Address;
  sudoerSetAt: number;
  governor: Address;
  governorUpdateAfter: number;
  interest_manager: Address;
  halter: Address;
  approver: Address;

  controller_code: Cell;
  pool_jetton_wallet_code: Cell;
  payout_minter_code: Cell;
};

export type PoolData = Awaited<ReturnType<InstanceType<typeof Pool>['getFullData']>>;

export function poolConfigToCell(config: PoolConfig): Cell {
  const emptyRoundData = beginCell()
    .storeUint(0, 1) // empty dict
    .storeUint(0, 32) // round_id
    .storeUint(0, 32) // active borrowers
    .storeCoins(0) // borrowed
    .storeCoins(0) // expected
    .storeCoins(0) // returned
    .storeUint(0, 1) // profit sign
    .storeCoins(0) // profit
    .endCell();

  const mintersData = beginCell()
    .storeAddress(config.pool_jetton)
    .storeCoins(config.pool_jetton_supply)
    .storeUint(0, 1) // no deposit_minter
    .storeUint(0, 1) // no withdrawal_minter
    .endCell();
  const roles = beginCell()
    .storeAddress(config.sudoer)
    .storeUint(0, 48) // sudoer set at
    .storeAddress(config.governor)
    .storeUint(0xffffffffffff, 48) // givernor update after
    .storeAddress(config.interest_manager)
    .storeRef(
      beginCell()
        .storeAddress(config.halter)
        .storeAddress(config.approver)
        .endCell(),
    )
    .endCell();
  const codes = beginCell()
    .storeRef(config.controller_code)
    .storeRef(config.pool_jetton_wallet_code)
    .storeRef(config.payout_minter_code)
    .endCell();
  return beginCell()
    .storeUint(0, 8) // state NORMAL
    .storeInt(0n, 1) // halted?
    .storeCoins(0) // total_balance
    .storeRef(mintersData)
    .storeUint(Conf.testInterest, 24) // minimal interest_rate
    .storeInt(config.optimistic_deposit_withdrawals, 1) // optimistic_deposit_withdrawals
    .storeInt(-1n, 1) // deposits_open?
    .storeUint(0, 256) // saved_validator_set_hash
    .storeRef(
      beginCell()
        .storeRef(emptyRoundData)
        .storeRef(emptyRoundData)
        .endCell(),
    )
    .storeCoins(100 * 1000000000) // min_loan_per_validator
    .storeCoins(1000000 * 1000000000) // max_loan_per_validator
    .storeUint(155 * (2 ** 8), 24) // governance fee
    .storeRef(roles)
    .storeRef(codes)
    .endCell();
}

export function dataToFullConfig(data: PoolData) : PoolFullConfig {
  /*
   * I know we could use Object.keys/Object.assign kind of magic.
   * But i feel like it should be explicit for easier TS
   * level debug if any fields of either type changes.
   * Let's do it dumb and reliable way
   */
  return {
    state: data.state as (0 | 1),
    halted: data.halted,
    totalBalance: data.totalBalance,
    poolJetton: data.poolJettonMinter,
    poolJettonSupply: data.poolJettonSupply,
    depositMinter: data.depositPayout,
    requestedForDeposit: data.requestedForDeposit,
    withdrawalMinter: data.withdrawalPayout,
    requestedForWithdrawal: data.requestedForWithdrawal,
    interestRate: data.interestRate,
    optimisticDepositWithdrawals: data.optimisticDepositWithdrawals,
    depositsOpen: data.depositsOpen,
    savedValidatorSetHash: data.savedValidatorSetHash,
    currentRound: data.currentRound,
    prevRound: data.previousRound,
    minLoanPerValidator: data.minLoan,
    maxLoanPerValidator: data.maxLoan,
    governanceFee: data.governanceFee,
    sudoer: data.sudoer,
    sudoerSetAt: data.sudoerSetAt,
    governor: data.governor,
    governorUpdateAfter: data.governorUpdateAfter,
    interest_manager: data.interestManager,
    halter: data.halter,
    approver: data.approver,
    controller_code: data.controllerCode,
    pool_jetton_wallet_code: data.jettonWalletCode,
    payout_minter_code: data.payoutMinterCode,
  };
}

export function poolFullConfigToCell(config: PoolFullConfig): Cell {
  const abs = (x:bigint) => { return x < 0n ? -x : x; };
  const serializeRoundData = (round: RoundData) => beginCell()
    .storeMaybeRef(round.borrowers)
    .storeUint(round.roundId, 32) // round_id
    .storeUint(round.activeBorrowers, 32) // active borrowers
    .storeCoins(round.borrowed) // borrowed
    .storeCoins(round.expected) // expected
    .storeCoins(round.returned) // returned
    .storeUint(Number(round.profit < 0), 1) // profit sign
    .storeCoins(abs(round.profit)) // profit
    .endCell();

  let mintersData = beginCell()
    .storeAddress(config.poolJetton)
    .storeCoins(config.poolJettonSupply);
  if (config.depositMinter) {
    mintersData = mintersData.storeUint(1, 1)
      .storeUint(0, 1)
      .storeAddress(config.depositMinter!)
      .storeCoins(config.requestedForDeposit!);
  } else {
    mintersData = mintersData.storeUint(0, 1);
  }
  if (config.withdrawalMinter) {
    mintersData = mintersData.storeUint(1, 1)
      .storeBit(0)
      .storeAddress(config.withdrawalMinter!)
      .storeCoins(config.requestedForWithdrawal!);
  } else {
    mintersData = mintersData.storeUint(0, 1);
  }
  const minters:Cell = mintersData.endCell();
  const roles = beginCell()
    .storeAddress(config.sudoer)
    .storeUint(config.sudoerSetAt, 48) // sudoer set at
    .storeAddress(config.governor)
    .storeUint(config.governorUpdateAfter, 48) // givernor update after
    .storeAddress(config.interest_manager)
    .storeRef(
      beginCell()
        .storeAddress(config.halter)
        .storeAddress(config.approver)
        .endCell(),
    )
    .endCell();
  const codes = beginCell()
    .storeRef(config.controller_code)
    .storeRef(config.pool_jetton_wallet_code)
    .storeRef(config.payout_minter_code)
    .endCell();
  return beginCell()
    .storeUint(config.state, 8) // state NORMAL
    .storeBit(config.halted) // halted?
    .storeCoins(config.totalBalance) // total_balance
    .storeRef(minters)
    .storeUint(config.interestRate, 24) // minimal interest_rate
    .storeBit(config.optimisticDepositWithdrawals) // optimistic_deposit_withdrawals
    .storeBit(config.depositsOpen) // deposits_open?
    .storeUint(config.savedValidatorSetHash, 256) // saved_validator_set_hash
    .storeRef(
      beginCell()
        .storeRef(serializeRoundData(config.currentRound))
        .storeRef(serializeRoundData(config.prevRound))
        .endCell(),
    )
    .storeCoins(config.minLoanPerValidator) // min_loan_per_validator
    .storeCoins(config.maxLoanPerValidator) // max_loan_per_validator
    .storeUint(config.governanceFee, 24) // governance fee
    .storeRef(roles)
    .storeRef(codes)
    .endCell();
}

export type BorrowerDiscription = {
  borrowed: bigint;
  accounted_interest: bigint;
};

export const BorrowerDiscriptionValue: DictionaryValue<BorrowerDiscription> = {
  serialize: (src, builder) => {
    builder.storeCoins(src.borrowed);
    builder.storeCoins(src.accounted_interest);
  },
  parse: (src) => {
    return {
      borrowed: src.loadCoins(),
      accounted_interest: src.loadCoins(),
    };
  },
};

export class Pool implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new Pool(address);
  }

  static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
    const data = poolConfigToCell(config);
    const init = { code, data };
    return new Pool(contractAddress(workchain, init), init);
  }

  static createFromFullConfig(config: PoolFullConfig, code: Cell, workchain = 0) {
    const data = poolFullConfigToCell(config);
    const init = { code, data };
    return new Pool(contractAddress(workchain, init), init);
  }

  // eslint-disable-next-line class-methods-use-this
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        // TODO make proper init message
        .storeUint(LiquidOpCode.pool.touch, 32) // op = touch
        .storeUint(0, 64) // query id
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendRequestControllerDeploy(provider: ContractProvider, via: Sender, value: bigint, controllerId: number) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.pool.deploy_controller, 32) // op = pool::deploy_controller
        .storeUint(0, 64) // query id
        .storeUint(controllerId, 32) // controller_id
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendDeposit(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.pool.deposit, 32) // op = pool::deposit
        .storeUint(1, 64) // query id
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendSetDepositSettings(
    provider: ContractProvider, via: Sender, value: bigint, optimistic: Boolean, depositOpen: Boolean,
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.governor.set_deposit_settings, 32) // op = setDepositSettings
        .storeUint(1, 64) // query id
        .storeUint(Number(optimistic), 1)
        .storeUint(Number(depositOpen), 1)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendTouch(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.pool.touch, 32) // op = touch
        .storeUint(1, 64) // query id
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendDonate(provider: ContractProvider, via: Sender, value:bigint) {
    await provider.internal(via, {
      value: value + toNano('1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.pool.donate, 32) // op = touch
        .storeUint(1, 64) // query id
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendSetInterest(provider: ContractProvider, via: Sender, interest:number) {
    await provider.internal(via, {
      value: toNano('0.3'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.interestManager.set_interest, 32) // op = touch
        .storeUint(1, 64) // query id
        .storeUint(interest, 24)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendSetGovernanceFee(
    provider: ContractProvider, via: Sender, fee: number | bigint, query_id: number | bigint = 1,
  ) {
    await provider.internal(via, {
      value: toNano('0.3'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.governor.set_governance_fee, 32)
        .storeUint(query_id, 64)
        .storeUint(fee, 24)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendSetRoles(provider: ContractProvider, via: Sender,
    governor: Address | null,
    interestManager: Address | null,
    halter: Address | null,
    approver: Address | null) {
    let body = beginCell()
      .storeUint(LiquidOpCode.governor.set_roles, 32)
      .storeUint(1, 64);
    for (const role of [governor, interestManager, halter, approver]) {
      if (role) {
        body = body.storeBit(true).storeAddress(role!);
      } else {
        body = body.storeBit(false);
      }
    }
    await provider.internal(via, {
      value: toNano('1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: body.endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendSetSudoer(provider: ContractProvider, via: Sender, sudoer: Address, value: bigint = toNano('1')) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value,
      body: beginCell().storeUint(LiquidOpCode.governor.set_sudoer, 32)
        .storeUint(1, 64)
        .storeAddress(sudoer)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendSudoMsg(provider: ContractProvider, via: Sender, mode:number, msg: Message, query_id: bigint | number = 0) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value: toNano('1'),
      body: beginCell().storeUint(LiquidOpCode.sudo.send_message, 32)
        .storeUint(query_id, 64)
        .storeUint(mode, 8)
        .storeRef(beginCell().store(storeMessage(msg)).endCell())
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendHaltMessage(provider: ContractProvider, via: Sender, query_id: bigint | number = 0) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value: toNano('1'),
      body: beginCell().storeUint(LiquidOpCode.halter.halt, 32)
        .storeUint(query_id, 64)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendUnhalt(provider: ContractProvider, via: Sender, query_id: bigint | number = 0) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value: toNano('1'),
      body: beginCell().storeUint(LiquidOpCode.governor.unhalt, 32)
        .storeUint(query_id, 64)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendPrepareGovernanceMigration(
    provider: ContractProvider, via: Sender, time: number | bigint, query_id: bigint | number = 0,
  ) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      value: toNano('1'),
      body: beginCell().storeUint(LiquidOpCode.governor.prepare_governance_migration, 32)
        .storeUint(query_id, 64)
        .storeUint(time, 48)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendUpgrade(provider: ContractProvider, via: Sender,
    data: Cell | null, code: Cell | null, afterUpgrade: Cell | null) {
    // upgrade#96e7f528 query_id:uint64
    // data:(Maybe ^Cell) code:(Maybe ^Cell) after_upgrade:(Maybe ^Cell) = InternalMsgBody;

    await provider.internal(via, {
      value: toNano('0.5'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.sudo.upgrade, 32) // op = touch
        .storeUint(1, 64) // query id
        .storeMaybeRef(data)
        .storeMaybeRef(code)
        .storeMaybeRef(afterUpgrade)
        .endCell(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async sendDepositSettings(provider:ContractProvider, via:Sender, optimistic:boolean, open:boolean) {
    await provider.internal(via, {
      value: toNano('0.15'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(LiquidOpCode.governor.set_deposit_settings, 32)
        .storeUint(1, 64)
        .storeBit(optimistic)
        .storeBit(open)
        .endCell(),
    });
  }

  // Get methods
  /*
  async getDepositPayout(provider: ContractProvider) {
      let res = await provider.get('get_current_round_deposit_payout', []);
      let minter = res.stack.readAddress();
      return AwaitedJettonMinter.createFromAddress(minter);
  }
  async getWithdrawalPayout(provider: ContractProvider) {
      let res = await provider.get('get_current_round_withdrawal_payout', []);
      let minter = res.stack.readAddress();
      return AwaitedJettonMinter.createFromAddress(minter);
  }
  */
  async getDepositMinter(provider: ContractProvider) {
    const res = await this.getFullData(provider);
    return PayoutCollection.createFromAddress(res.depositPayout!);
  }

  async getWithdrawalMinter(provider: ContractProvider) {
    const res = await this.getFullData(provider);
    return PayoutCollection.createFromAddress(res.withdrawalPayout!);
  }

  async getFinanceData(provider: ContractProvider) {
    return this.getFullData(provider);
  }

  // eslint-disable-next-line class-methods-use-this
  async getLoan(
    provider: ContractProvider,
    controllerId: number,
    validator: Address,
    previous = false,
    updateRound = true,
  ) {
    const args = new TupleBuilder();
    args.writeNumber(controllerId);
    args.writeAddress(validator);
    args.writeBoolean(previous);
    args.writeBoolean(updateRound);
    const { stack } = await provider.get('get_loan', args.build());
    return {
      borrowed: stack.readBigNumber(),
      interestAmount: stack.readBigNumber(),
    };
  }

  async getRoundId(provider: ContractProvider) {
    const res = await this.getFullData(provider);
    return res.currentRound.roundId;
  }

  // eslint-disable-next-line class-methods-use-this
  async getBorrowersDict(provider: ContractProvider, previous = false) {
    const res = await this.getFullData(provider);
    let borrowers = res.currentRound.borrowers;
    if (previous) {
      borrowers = res.previousRound.borrowers;
    }
    // eslint-disable-next-line no-null/no-null
    if (borrowers == null) {
      return Dictionary.empty();
    }
    const dict = Dictionary.loadDirect(
      Dictionary.Keys.BigInt(256),
      BorrowerDiscriptionValue,
      borrowers.asSlice(),
    );
    return dict;
  }

  async getMinMaxLoanPerValidator(provider: ContractProvider) {
    const res = await this.getFullData(provider);
    return { min: res.minLoan, max: res.maxLoan };
  }

  // eslint-disable-next-line class-methods-use-this
  async getControllerAddress(provider: ContractProvider, id:number, validator: Address) {
    const { stack } = await provider.get('get_controller_address', [
      { type: 'int', value: BigInt(id) },
      { type: 'slice', cell: beginCell().storeAddress(validator).endCell() },
    ]);

    return stack.readAddress();
  }

  // eslint-disable-next-line class-methods-use-this
  async getFullData(provider: ContractProvider) {
    const { stack } = await provider.get('get_pool_full_data', []);
    const state = stack.readNumber() as State;
    const halted = stack.readBoolean();
    const totalBalance = stack.readBigNumber();
    const interestRate = stack.readNumber();
    const optimisticDepositWithdrawals = stack.readBoolean();
    const depositsOpen = stack.readBoolean();
    const savedValidatorSetHash = stack.readBigNumber();

    const prv = stack.readTuple();
    const prvBorrowers = prv.readCellOpt();
    const prvRoundId = prv.readNumber();
    const prvActiveBorrowers = prv.readBigNumber();
    const prvBorrowed = prv.readBigNumber();
    const prvExpected = prv.readBigNumber();
    const prvReturned = prv.readBigNumber();
    const prvProfit = prv.readBigNumber();
    const previousRound = {
      borrowers: prvBorrowers,
      roundId: prvRoundId,
      activeBorrowers: prvActiveBorrowers,
      borrowed: prvBorrowed,
      expected: prvExpected,
      returned: prvReturned,
      profit: prvProfit,
    };

    const cur = stack.readTuple();
    const curBorrowers = cur.readCellOpt();
    const curRoundId = cur.readNumber();
    const curActiveBorrowers = cur.readBigNumber();
    const curBorrowed = cur.readBigNumber();
    const curExpected = cur.readBigNumber();
    const curReturned = cur.readBigNumber();
    const curProfit = cur.readBigNumber();
    const currentRound = {
      borrowers: curBorrowers,
      roundId: curRoundId,
      activeBorrowers: curActiveBorrowers,
      borrowed: curBorrowed,
      expected: curExpected,
      returned: curReturned,
      profit: curProfit,
    };

    const minLoan = stack.readBigNumber();
    const maxLoan = stack.readBigNumber();
    const governanceFee = stack.readNumber();

    const poolJettonMinter = stack.readAddress();
    const poolJettonSupply = stack.readBigNumber();

    const depositPayout = stack.readAddressOpt();
    const requestedForDeposit = stack.readBigNumber();

    const withdrawalPayout = stack.readAddressOpt();
    const requestedForWithdrawal = stack.readBigNumber();

    const sudoer = stack.readAddress();
    const sudoerSetAt = stack.readNumber();

    const governor = stack.readAddress();
    const governorUpdateAfter = stack.readNumber();
    const interestManager = stack.readAddress();
    const halter = stack.readAddress();
    const approver = stack.readAddress();

    const controllerCode = stack.readCell();
    const jettonWalletCode = stack.readCell();
    const payoutMinterCode = stack.readCell();

    const projectedTotalBalance = stack.readBigNumber();
    const projectedPoolSupply = stack.readBigNumber();

    return {
      state,
      halted,
      totalBalance,
      interestRate,
      optimisticDepositWithdrawals,
      depositsOpen,
      savedValidatorSetHash,

      previousRound,
      currentRound,

      minLoan,
      maxLoan,
      governanceFee,

      poolJettonMinter,
      poolJettonSupply,
      supply: poolJettonSupply,
      depositPayout,
      requestedForDeposit,
      withdrawalPayout,
      requestedForWithdrawal,

      sudoer,
      sudoerSetAt,
      governor,
      governorUpdateAfter,
      interestManager,
      halter,
      approver,

      controllerCode,
      jettonWalletCode,
      payoutMinterCode,
      projectedTotalBalance,
      projectedPoolSupply,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async getFullDataRaw(provider: ContractProvider) {
    const { stack } = await provider.get('get_pool_full_data_raw', []);
    const state = stack.readNumber() as State;
    const halted = stack.readBoolean();
    const totalBalance = stack.readBigNumber();
    const interestRate = stack.readNumber();
    const optimisticDepositWithdrawals = stack.readBoolean();
    const depositsOpen = stack.readBoolean();
    const savedValidatorSetHash = stack.readBigNumber();

    const prv = stack.readTuple();
    const prvBorrowers = prv.readCellOpt();
    const prvRoundId = prv.readNumber();
    const prvActiveBorrowers = prv.readBigNumber();
    const prvBorrowed = prv.readBigNumber();
    const prvExpected = prv.readBigNumber();
    const prvReturned = prv.readBigNumber();
    const prvProfit = prv.readBigNumber();
    const previousRound = {
      borrowers: prvBorrowers,
      roundId: prvRoundId,
      activeBorrowers: prvActiveBorrowers,
      borrowed: prvBorrowed,
      expected: prvExpected,
      returned: prvReturned,
      profit: prvProfit,
    };

    const cur = stack.readTuple();
    const curBorrowers = cur.readCellOpt();
    const curRoundId = cur.readNumber();
    const curActiveBorrowers = cur.readBigNumber();
    const curBorrowed = cur.readBigNumber();
    const curExpected = cur.readBigNumber();
    const curReturned = cur.readBigNumber();
    const curProfit = cur.readBigNumber();
    const currentRound = {
      borrowers: curBorrowers,
      roundId: curRoundId,
      activeBorrowers: curActiveBorrowers,
      borrowed: curBorrowed,
      expected: curExpected,
      returned: curReturned,
      profit: curProfit,
    };

    const minLoan = stack.readBigNumber();
    const maxLoan = stack.readBigNumber();
    const governanceFee = stack.readNumber();

    const poolJettonMinter = stack.readAddress();
    const poolJettonSupply = stack.readBigNumber();

    const depositPayout = stack.readAddressOpt();
    const requestedForDeposit = stack.readBigNumber();

    const withdrawalPayout = stack.readAddressOpt();
    const requestedForWithdrawal = stack.readBigNumber();

    const sudoer = stack.readAddress();
    const sudoerSetAt = stack.readNumber();

    const governor = stack.readAddress();
    const governorUpdateAfter = stack.readNumber();
    const interestManager = stack.readAddress();
    const halter = stack.readAddress();
    const approver = stack.readAddress();

    const controllerCode = stack.readCell();
    const jettonWalletCode = stack.readCell();
    const payoutMinterCode = stack.readCell();

    const projectedTotalBalance = stack.readBigNumber();
    const projectedPoolSupply = stack.readBigNumber();

    return {
      state,
      halted,
      totalBalance,
      interestRate,
      optimisticDepositWithdrawals,
      depositsOpen,
      savedValidatorSetHash,

      previousRound,
      currentRound,

      minLoan,
      maxLoan,
      governanceFee,

      poolJettonMinter,
      poolJettonSupply,
      supply: poolJettonSupply,
      depositPayout,
      requestedForDeposit,
      withdrawalPayout,
      requestedForWithdrawal,

      sudoer,
      sudoerSetAt,
      governor,
      governorUpdateAfter,
      interestManager,
      halter,
      approver,

      controllerCode,
      jettonWalletCode,
      payoutMinterCode,
      projectedTotalBalance,
      projectedPoolSupply,
    };
  }
}
