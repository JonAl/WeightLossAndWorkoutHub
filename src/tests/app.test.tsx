import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../app/App';
import { db } from '../db/schema';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ offlineReady: [false, () => {}], needRefresh: [false, () => {}], updateServiceWorker: () => {} })
}));

describe('App flow (jsdom + fake IndexedDB)', () => {
  beforeAll(async () => { await db.open(); for (const t of db.tables) await t.clear(); });

  it('onboards in Greek, flags unconfirmed values, then logs a weight that persists', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    expect(await screen.findByText('Καλώς ήρθες στο Weight Loss Hub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Επόμενο/ }));
    expect(await screen.findByText('Λίγα στοιχεία για σένα')).toBeInTheDocument();
    expect((screen.getByLabelText(/Ύψος/) as HTMLInputElement).value).toBe('182');
    await user.click(screen.getByRole('button', { name: /Επόμενο/ }));

    const cw = await screen.findByLabelText(/Τρέχον βάρος/);
    expect((cw as HTMLInputElement).value).toBe('145');
    await user.clear(cw); await user.type(cw, '144.6');
    await user.click(screen.getByRole('button', { name: /Επόμενο/ }));
    await user.click(await screen.findByRole('button', { name: /Ολοκλήρωση/ }));

    // Dashboard with initial entry and the unconfirmed-values notice (nothing was confirmed)
    expect(await screen.findByRole('heading', { name: 'Αρχική', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/δεν έχουν επιβεβαιωθεί/)).toBeInTheDocument();
    await waitFor(async () => expect(await db.weights.count()).toBe(1));
    expect((await db.weights.toArray())[0].weightKg).toBeCloseTo(144.6);
    const p = await db.profile.get('profile');
    expect(p!.unconfirmed).toContain('currentWeightKg');

    // Quick-add a weight
    await user.click(screen.getAllByRole('button', { name: /^Βάρος$/ })[0]);
    const dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByLabelText(/Βάρος \(kg\)/), '143,9');
    await user.click(within(dlg).getByRole('button', { name: 'Αποθήκευση' }));
    await waitFor(async () => expect(await db.weights.count()).toBe(2));

    // Validation: empty weight is rejected with a localized message
    await user.click(screen.getAllByRole('button', { name: /^Βάρος$/ })[0]);
    const dlg2 = await screen.findByRole('dialog');
    await user.click(within(dlg2).getByRole('button', { name: 'Αποθήκευση' }));
    expect(await within(dlg2).findByText('Υποχρεωτικό πεδίο')).toBeInTheDocument();
    await user.click(within(dlg2).getByRole('button', { name: 'Ακύρωση' }));

    // Persistence across a "reload" (remount)
    unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Αρχική', level: 1 })).toBeInTheDocument();
    expect(await db.weights.count()).toBe(2);
  });

  it('switches the whole UI to English and keeps it after remount', async () => {
    await db.settings.update('settings', { language: 'en' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('Protein today').length).toBeGreaterThan(0);
  });
});
