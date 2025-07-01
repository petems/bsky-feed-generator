import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as whatsAlf from './whats-alf'

/**
 * Algorithm handler function type
 */
export type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

/**
 * Registry of available feed algorithms
 * Maps algorithm shortnames to their handler functions
 */
const algos: Record<string, AlgoHandler> = {
  [whatsAlf.shortname]: whatsAlf.handler,
}

/**
 * Gets the list of available algorithm names
 * @returns Array of algorithm shortnames
 */
export const getAlgorithmNames = (): string[] => {
  return Object.keys(algos)
}

/**
 * Gets a specific algorithm handler by name
 * @param name - Algorithm shortname
 * @returns Algorithm handler function or undefined
 */
export const getAlgorithm = (name: string): AlgoHandler | undefined => {
  return algos[name]
}

export default algos