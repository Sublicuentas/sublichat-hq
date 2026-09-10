'use strict';
const { allowsNavigation } = require('../activar-tv-platforms');
const { TVError } = require('./manager');

const clean = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function interpretEvidence(snapshot, email) {
  const headings = clean(snapshot.headings);
  const authenticated = !snapshot.loginVisible && (snapshot.logoutVisible || snapshot.profilePicker);
  const emailMatches = authenticated && (snapshot.emails || []).some(value => value.toLowerCase() === email.toLowerCase());
  const challenge = snapshot.challenge || /verifica.{0,35}(identidad|humano)|verification code|codigo.{0,35}(correo|verificacion)|one.time (code|password)/.test(headings);
  const badLogin = /incorrect password|wrong password|invalid (email|password)|(?:contrasena|clave).{0,20}incorrect|no (?:hemos )?(?:encontrado|encontramos).{0,25}cuenta/.test(clean(snapshot.alerts));
  const badCode = /(?:code|codigo).{0,35}(?:invalid|incorrect|expir|vencid)|(?:invalid|incorrect|expired).{0,15}(?:code|codigo)/.test(clean(snapshot.alerts));
  // Positive confirmation must be visible in a heading/status, never inferred
  // from an HTTP 200, a click, a timer or a generic redirect.
  const completion = /^(?:[¡!✓✅✔\s]*)(?:(?:tu|su|your|the|el|este) )?(?:tv|televisor|device|dispositivo) (?:(?:ya |successfully )?)(?:(?:ha sido|se ha|esta|is|has been|is now|was|se encuentra) )?(?:successfully )?(?:activado|vinculado|conectado|registrado|registered|activated|linked|connected)(?: (?:correctamente|con exito|successfully))?[.!¡\s]*$/;
  const activationSuccess = !snapshot.loginVisible && !badCode && headings.split('\n').some(line => completion.test(line.trim()));
  return { authenticated, emailMatches, loginVisible: snapshot.loginVisible, challenge, activationSuccess,
    error: badLogin ? 'La plataforma rechazó el correo o la clave. Revise los datos en su página.' :
      badCode ? 'La plataforma rechazó el código del TV. Solicite uno nuevo y vuelva a intentarlo.' : '' };
}

class PlatformBrowser {
  constructor(platform, context, page) { this.platform = platform; this.context = context; this.page = page; this.closed = false; }
  async firstVisible(selectors) {
    for (const selector of selectors) {
      const items = this.page.locator(selector);
      for (let i = 0, count = Math.min(await items.count(), 15); i < count; i++) {
        const item = items.nth(i);
        if (await item.isVisible() && await item.isEnabled()) return item;
      }
    }
    return null;
  }
  async clickNamed(pattern) {
    for (const role of ['button', 'link']) {
      const items = this.page.getByRole(role, { name: pattern });
      for (let i = 0, count = Math.min(await items.count(), 12); i < count; i++) {
        const item = items.nth(i);
        if (await item.isVisible() && await item.isEnabled()) { await item.click({ timeout: 4000 }); return true; }
      }
    }
    return false;
  }
  async settle() {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  }
  async waitForLoginFields() {
    await this.page.locator('input[type="email"]:visible,input[autocomplete="username"]:visible,input[name="email"]:visible,input[name="userLoginId"]:visible,#ap_email:visible,input[name="identifier"]:visible').first().waitFor({ state:'visible', timeout:8000 }).catch(() => {});
  }
  trustedPage() { return allowsNavigation(this.page.url(), this.platform); }
  assertTrustedPage() {
    if (!this.trustedPage()) throw new TVError(409, 'La plataforma abrió un acceso externo. Complételo manualmente en la página mostrada o inicie una sesión nueva.');
  }
  async login(email, password) {
    await this.page.goto(this.platform.login, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // If the provider redirects to an external identity/challenge host, keep
    // that page visible for the operator but never autofill credentials there.
    if (!this.trustedPage()) return;
    if (this.platform.id !== 'prime') await this.waitForLoginFields();
    // El acceso de Prime debe generar su propio enlace OpenID. Paramount puede
    // devolver la portada regional y exige volver a pulsar Iniciar sesión.
    let field = await this.firstVisible(['input[type="email"]', 'input[autocomplete="username"]', 'input[name="email"]', 'input[name="userLoginId"]', '#ap_email', 'input[name="identifier"]']);
    if (!field) {
      await this.clickNamed(/^(?:iniciar sesi[oó]n|sign in|log in|identificarse)$/i);
      await this.settle();
      await this.waitForLoginFields();
      field = await this.firstVisible(['input[type="email"]', 'input[autocomplete="username"]', 'input[name="email"]', 'input[name="userLoginId"]', '#ap_email', 'input[name="identifier"]']);
    }
    if (!field) return; // La página remota permite completar un diseño distinto.
    if (!this.trustedPage()) return;
    await field.fill(email);
    let key = await this.firstVisible(['input[type="password"]']);
    if (!key) {
      await this.clickNamed(/^(?:continuar|continue|siguiente|next)$/i);
      await this.settle();
      await this.page.locator('input[type="password"]:visible').first().waitFor({ state:'visible', timeout:8000 }).catch(() => {});
      key = await this.firstVisible(['input[type="password"]']);
    }
    if (key) {
      if (!this.trustedPage()) return;
      await key.fill(password);
      await this.clickNamed(/^(?:iniciar sesi[oó]n|sign in|log in|continuar|continue|entrar|acceder)$/i);
      await this.settle();
    }
  }
  async openActivation() {
    await this.page.goto(this.platform.activation, { waitUntil: 'domcontentloaded', timeout: 30000 });
    this.assertTrustedPage();
  }
  async activate(code) {
    this.assertTrustedPage();
    const candidates = this.page.locator('input:not([type="hidden"]):not([type="password"]):not([type="email"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="search"])');
    const fields = [];
    for (let i = 0, count = Math.min(await candidates.count(), 30); i < count; i++) {
      const input = candidates.nth(i);
      if (!(await input.isVisible()) || !(await input.isEnabled())) continue;
      const label = [await input.getAttribute('name'), await input.getAttribute('id'), await input.getAttribute('aria-label'), await input.getAttribute('placeholder'), await input.getAttribute('autocomplete')].join(' ');
      if (/search|buscar|email|correo|password|contrasena/i.test(label)) continue;
      fields.push({ input, label, length: Number(await input.getAttribute('maxlength')) });
    }
    const digits = fields.filter(f => f.length === 1);
    if (digits.length === code.length) {
      for (let i = 0; i < digits.length; i++) await digits[i].input.fill(code[i]);
    } else {
      const field = fields.find(f => /code|codigo|c[oó]digo|token|registration/i.test(f.label));
      if (!field) throw new TVError(409, 'Escriba el código directamente en la página de la plataforma y complete su botón de activación.');
      await field.input.fill(code);
    }
    if (!(await this.clickNamed(/^(?:continuar|continue|activar|activate|registrar dispositivo|register device|vincular|link device|conectar|connect|enviar|submit|ingresa el c[oó]digo para continuar|enter code to continue)$/i))) {
      throw new TVError(409, 'El código está escrito. Complete el botón de activación en la página de la plataforma.');
    }
    await this.settle();
  }
  async inspect(email) {
    const snapshot = await this.page.evaluate(() => {
      const visible = element => !!(element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      const textOf = selectors => [...document.querySelectorAll(selectors)].filter(visible).map(el => el.innerText || '').join('\n');
      const text = document.body?.innerText || '';
      const headings = textOf('h1,h2,h3,[role="status"],[role="alert"]');
      const loginVisible = [...document.querySelectorAll('input[type="password"],input[type="email"],input[autocomplete="username"]')].some(visible);
      const logoutVisible = [...document.querySelectorAll('a,button,[role="menuitem"]')].filter(visible).some(el => /^(?:cerrar sesi[oó]n|salir de la cuenta|sign out|log out)$/i.test((el.innerText || '').trim()));
      const profilePicker = /(?:qui[eé]n (?:est[aá] viendo|ver[aá]|va a ver)|who(?:'|’)?s watching|who is watching|selecciona (?:tu|un) perfil|elige (?:tu|un) perfil)/i.test(headings) &&
        !![...document.querySelectorAll('[data-profile-id],.profile-link,.profile-icon,[data-testid*="profile"],[aria-label*="perfil"],[aria-label*="profile"]')].find(visible);
      const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      const challenge = [...document.querySelectorAll('iframe[title*="challenge"],iframe[title*="reCAPTCHA"],iframe[src*="hcaptcha"],input[autocomplete="one-time-code"]')].some(visible);
      return { text: text.slice(0,60000), headings: headings.slice(0,12000), alerts: textOf('[role="alert"],.error,[data-testid*="error"],.a-alert-content').slice(0,8000), loginVisible, logoutVisible, profilePicker, emails, challenge };
    });
    return interpretEvidence(snapshot, email);
  }
  async frame() {
    const data = await this.page.screenshot({ type: 'jpeg', quality: 65, fullPage: false, timeout: 7000,
      mask: [this.page.locator('input[type="password"]')], maskColor: '#dbe6ef' });
    let host = '';
    try { host = new URL(this.page.url()).hostname; } catch (_) {}
    return { image: data.toString('base64'), width: 1000, height: 760, host };
  }
  async interact(event) {
    if (event.type === 'tap') {
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || event.x < 0 || event.x >= 1000 || event.y < 0 || event.y >= 760) throw new TVError(400, 'Posición no válida.');
      await this.page.mouse.click(event.x, event.y);
    } else if (event.type === 'text') {
      if (typeof event.text !== 'string' || event.text.length > 1024) throw new TVError(400, 'Texto no válido.');
      let target;
      for (const frame of this.page.frames()) {
        const active = frame.locator('input:focus,textarea:focus');
        if (await active.count() === 1 && await active.isVisible() && await frame.evaluate(() => document.hasFocus())) { target = active; break; }
      }
      if (!target) throw new TVError(409, 'Toque primero el campo donde desea escribir.');
      await target.fill(event.text);
    } else if (event.type === 'key') {
      if (!['Enter', 'Tab', 'Shift+Tab', 'Backspace', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.key)) throw new TVError(400, 'Tecla no válida.');
      await this.page.keyboard.press(event.key);
    } else if (event.type === 'scroll') {
      if (![-500, 500].includes(event.delta)) throw new TVError(400, 'Desplazamiento no válido.');
      await this.page.mouse.wheel(0, event.delta);
    } else throw new TVError(400, 'Acción no válida.');
    await this.settle();
  }
  async close() { if (!this.closed) { this.closed = true; await this.context.close(); } }
}

module.exports = { PlatformBrowser, interpretEvidence };
