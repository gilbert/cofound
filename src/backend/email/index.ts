export type EmailParams = {
  to: string
  subject: string
  htmlContent: string
  textContent: string
}

export abstract class Emailer {
  /** If true, then emails will be sent via 3rd party services even during development. */
  force = false

  async send(params: EmailParams): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return
    } else if (process.env.NODE_ENV === 'development' && !this.force) {
      console.log(`Email to ${params.to}:`)
      console.log(params.textContent)
    } else {
      this.sendEmail(params)
    }
  }
  protected abstract sendEmail(params: EmailParams): Promise<any>
}

export class DevEmailer extends Emailer {
  protected async sendEmail() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[cofound] No email provider configured')
    }
  }
}

//
// Email senders that don't require extra libraries
//

export class PostmarkEmailer extends Emailer {
  private from: string
  private apiToken: string
  private MessageStream: string
  constructor(params: { from: string; apiToken: string; MessageStream: string }) {
    super()
    this.from = params.from
    this.apiToken = params.apiToken
    this.MessageStream = params.MessageStream
  }

  async sendEmail(params: EmailParams) {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.apiToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        From: this.from,
        To: params.to,
        Subject: params.subject,
        HtmlBody: params.htmlContent,
        TextBody: params.textContent,
        MessageStream: this.MessageStream,
      }),
    })
    if (res.status !== 200) {
      console.log('[PostmarkEmailer] Send error', res.status, await res.text())
    }
  }
}
