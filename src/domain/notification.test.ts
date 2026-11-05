import { describe, expect, it } from 'vitest';
import { notificationSource, parseAmount, readNotification } from './notification';

const NUBANK = 'com.nu.production';
const read = (title: string, text: string, app = NUBANK) => readNotification({ app, title, text });

describe('reading a purchase notification', () => {
  it('reads the owner\'s Nubank credit purchase', () => {
    expect(read('Compra aprovada', 'Compra no cartão de crédito aprovada no valor de R$ 1.234,56 no estabelecimento PADARIA DO ZE.')).toEqual({
      status: 'expense',
      source: 'nubank',
      kind: 'card',
      amountCents: 123456,
      currency: 'BRL',
      merchant: 'PADARIA DO ZE',
    });
  });

  it('reads the older Nubank format and drops the card\'s final digits', () => {
    expect(read('Nubank', 'Compra de R$ 25,90 APROVADA em IFOOD *RESTAURANTE para o cartão com final 1234')).toMatchObject({
      status: 'expense',
      kind: 'card',
      amountCents: 2590,
      merchant: 'IFOOD *RESTAURANTE',
    });
  });

  it('reads a Pix sent, with the receiver as the merchant', () => {
    expect(read('Pix enviado', 'Você enviou um Pix de R$ 50,00 para Maria Silva.')).toMatchObject({
      status: 'expense',
      kind: 'pix',
      amountCents: 5000,
      merchant: 'Maria Silva',
    });
  });

  it('reads benefit cards and Wise in English', () => {
    expect(read('Flash', 'Compra aprovada de R$ 32,00 em RESTAURANTE BOM', 'com.flash.benefits')).toMatchObject({
      source: 'flash',
      amountCents: 3200,
      merchant: 'RESTAURANTE BOM',
    });
    expect(read('Card payment', 'You spent 12.50 USD at Starbucks with your card', 'com.transferwise.android')).toMatchObject({
      source: 'wise',
      kind: 'card',
      amountCents: 1250,
      currency: 'USD',
      merchant: 'Starbucks',
    });
  });

  it('leaves the merchant empty when the text names none', () => {
    expect(read('Compra aprovada', 'Compra de R$ 10,00 aprovada')).toMatchObject({ status: 'expense', amountCents: 1000, merchant: null });
  });
});

describe('what is not an expense', () => {
  it.each([
    ['Pix recebido', 'Você recebeu um Pix de R$ 100,00 de João'],
    ['Compra recusada', 'Compra de R$ 25,90 recusada em LOJA X'],
    ['Pagamento da fatura', 'Recebemos o pagamento de R$ 900,00 da sua fatura'],
    ['Estorno', 'Estorno de R$ 25,90 da compra em LOJA X'],
    ['Boleto pago', 'Pagamento de boleto de R$ 80,00 realizado'],
    ['Nubank', 'Seu limite aumentou! Confira no app.'],
  ])('ignores "%s"', (title, text) => {
    expect(read(title, text).status).toBe('ignored');
  });

  it('marks a purchase without a readable amount as unreadable', () => {
    expect(read('Compra aprovada', 'Sua compra em LOJA X foi aprovada')).toEqual({ status: 'unreadable', source: 'nubank', kind: 'card' });
  });
});

describe('the pieces', () => {
  it.each([
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['25,9', 2590],
    ['1.234', 123400],
    ['12', 1200],
  ])('reads %s as %i cents', (value, cents) => {
    expect(parseAmount(value)).toBe(cents);
  });

  it('knows the sources by their app', () => {
    expect(notificationSource('com.nu.production')).toBe('nubank');
    expect(notificationSource('Swile')).toBe('swile');
    expect(notificationSource('br.com.caju')).toBe('caju');
    expect(notificationSource('com.whatsapp')).toBe('outra');
  });
});
