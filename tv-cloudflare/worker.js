import { DurableObject } from 'cloudflare:workers';
import { launch } from '@cloudflare/playwright';
import { cloudBrowserFactory } from './cloud-browser.js';
import { CloudController, readConfig } from './controller.js';
import { serve } from './gateway.js';

export class TVCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.controller = new CloudController({
      storage: ctx.storage, env,
      createBrowser: cloudBrowserFactory({ launch, binding: env.BROWSER, maxSessions: readConfig(env).maxSessions })
    });
  }
  fetch(request) { return serve(request, this.env, input => this.controller.action(input)); }
  alarm() { return this.controller.alarm(); }
}

export default {
  fetch(request, env) {
    return serve(request, env, input => {
      const coordinator = env.TV_SESSIONS.getByName('sublichat-tv-v1');
      return coordinator.fetch(new Request('https://tv.internal/v1/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.TV_BROWSER_SECRET },
        body: JSON.stringify(input)
      }));
    });
  }
};
