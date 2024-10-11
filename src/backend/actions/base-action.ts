import { CF_Runtime } from '../runtime'

export abstract class CF_BaseAction<Models> {
  models: CF_Runtime<Models>['models']
  jobQueue: CF_Runtime<Models>['jobQueue']
  init: CF_Runtime<Models>['get']

  constructor(runtime: CF_Runtime<Models>) {
    this.models = runtime.models
    this.jobQueue = runtime.jobQueue
    this.init = runtime.get
  }
}
