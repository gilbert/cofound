import { BaseDbConn } from './db/make-db'
import { SchemaExtra } from './db/schema'

export type Pod<Schema, DbConn, Models, SessionData, AnonSessionData> = {
  defaultSessionData: () => SessionData
  defaultAnonSessionData: () => AnonSessionData
  schema: Schema
  schemaExtra: SchemaExtra<Schema>
  makeModels: (db: DbConn) => Models
}
export function composePods<T extends Pod<any, any, any, any, any>[]>(scaffolds: T) {
  return {
    get schemas(): Intersect<InferArray<T>['schema']> {
      return reduceProp(scaffolds, 'schema')
    },
    get schemaExtras(): Intersect<InferArray<T>['schemaExtra']> {
      return reduceProp(scaffolds, 'schemaExtra')
    },
    makeModels(db: BaseDbConn): Intersect<InferArray<T>['makeModels']> {
      return scaffolds.reduce((acc, pod) => {
        return { ...acc, ...pod.makeModels(db) }
      }, {} as any)
    },
    defaultSessionData(): Intersect<InferArray<T>['defaultSessionData']> {
      return reduceProp(scaffolds, 'defaultSessionData')
    },
    defaultAnonSessionData(): Intersect<InferArray<T>['defaultAnonSessionData']> {
      return reduceProp(scaffolds, 'defaultAnonSessionData')
    },
  }
}

function reduceProp<K extends keyof Pod<any, any, any, any, any>>(pods: any[], prop: K): any {
  return pods.reduce((acc, pod) => {
    return { ...acc, ...pod[prop] }
  }, {} as any)
}

type Intersect<T> = UnionToIntersection<T extends (...args: any[]) => any ? ReturnType<T> : T>
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never
type InferArray<T extends any[]> = T extends (infer U)[] ? U : never
