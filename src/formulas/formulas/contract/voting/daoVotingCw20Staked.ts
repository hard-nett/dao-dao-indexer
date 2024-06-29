import { ContractFormula } from '@/types'

import { TotalPowerAtHeight, VotingPowerAtHeight } from '../../types'
import { makeSimpleContractFormula } from '../../utils'
import {
  StakerBalance,
  topStakers as cw20StakeTopStakers,
  stakedBalance,
  totalStaked,
} from '../staking/cw20Stake'

const CODE_IDS_KEYS = ['dao-voting-cw20-staked']

export { activeThreshold } from './common'

export const tokenContract = makeSimpleContractFormula<string>({
  transformation: 'token',
  fallbackKeys: ['token'],
})

export const stakingContract = makeSimpleContractFormula<string>({
  transformation: 'stakingContract',
  fallbackKeys: ['staking_contract'],
})

export const votingPowerAtHeight: ContractFormula<
  VotingPowerAtHeight,
  { address: string }
> = {
  // Filter by code ID since someone may modify the contract. This is also used
  // in DAO core to match the voting module and pass the query through.
  filter: {
    codeIdsKeys: CODE_IDS_KEYS,
  },
  compute: async (env) => {
    if (!env.args.address) {
      throw new Error('missing `address`')
    }

    const stakingContractAddress = await stakingContract.compute(env)
    if (!stakingContractAddress) {
      throw new Error('missing `stakingContractAddress`')
    }

    // Unrecognized contract.
    if (
      !(await env.contractMatchesCodeIdKeys(
        stakingContractAddress,
        ...(stakedBalance.filter?.codeIdsKeys ?? [])
      ))
    ) {
      throw new Error(`unsupported staking contract: ${stakingContractAddress}`)
    }

    const power =
      (await stakedBalance.compute({
        ...env,
        contractAddress: stakingContractAddress,
      })) || '0'

    return {
      power,
      height: Number(env.block.height),
    }
  },
}

export const votingPower: ContractFormula<string, { address: string }> = {
  filter: votingPowerAtHeight.filter,
  compute: async (env) => (await votingPowerAtHeight.compute(env)).power,
}

export const totalPowerAtHeight: ContractFormula<TotalPowerAtHeight> = {
  // Filter by code ID since someone may modify the contract. This is also used
  // in DAO core to match the voting module and pass the query through.
  filter: {
    codeIdsKeys: CODE_IDS_KEYS,
  },
  compute: async (env) => {
    const stakingContractAddress = (await stakingContract.compute(env)) ?? ''
    const power =
      (await totalStaked.compute({
        ...env,
        contractAddress: stakingContractAddress,
      })) || '0'

    return {
      power,
      height: Number(env.block.height),
    }
  },
}

export const totalPower: ContractFormula<string> = {
  filter: totalPowerAtHeight.filter,
  compute: async (env) => (await totalPowerAtHeight.compute(env)).power,
}

export const dao = makeSimpleContractFormula<string>({
  transformation: 'dao',
  fallbackKeys: ['dao'],
})

type Staker = StakerBalance & {
  votingPowerPercent: number
}

export const topStakers: ContractFormula<Staker[]> = {
  compute: async (env) => {
    const stakingContractAddress = await stakingContract.compute(env)
    if (!stakingContractAddress) {
      throw new Error('missing `stakingContractAddress`')
    }

    // Validate staking contract code ID matches filter.
    if (
      cw20StakeTopStakers.filter?.codeIdsKeys &&
      !(await env.contractMatchesCodeIdKeys(
        stakingContractAddress,
        ...cw20StakeTopStakers.filter.codeIdsKeys
      ))
    ) {
      throw new Error(
        `staking contract ${stakingContractAddress} had unexpected code ID for dao-voting-cw20-staked contract ${env.contractAddress}`
      )
    }

    // Get top stakers.
    const topStakers = await cw20StakeTopStakers.compute({
      ...env,
      contractAddress: stakingContractAddress,
    })

    // Get total power.
    const totalVotingPower = Number(await totalPower.compute(env))

    // Compute voting power for each staker.
    const stakers = topStakers.map((staker) => ({
      ...staker,
      votingPowerPercent:
        totalVotingPower === 0
          ? 0
          : (Number(staker.balance) / totalVotingPower) * 100,
    }))

    return stakers
  },
}
