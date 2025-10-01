type Email = { to: string; subject: string; text: string; attachments?: Array<{ path: string }>; };

export const email = {
  async send(msg: Email): Promise<void> {
    // Stubbed: In dev, just log. Later integrate with provider.
    console.log('Email send:', JSON.stringify(msg));
  }
};
