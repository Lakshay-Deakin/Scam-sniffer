// src/utils/analyzer.js
module.exports = function analyzeText(text) {
  const indicators = [];
  let score = 0;

  const lower = text.toLowerCase();
  console.log("Analyzing text:", text);

  // External links
  const linkRegex = /(https?:\/\/|www\.|bit\.ly|tinyurl)/i;
  if (linkRegex.test(text)) {
    indicators.push({ key: 'links', description: 'Contains external links' });
    score += 30;
  }

  // Urgency words
  const urgencyWords = [
    'urgent', 'immediately', 'asap', 'act now', 'deadline',
    'final notice', 'limited time', 'respond quickly', 'within 24 hours',
    'last chance', 'expires soon', 'don’t delay', 'time-sensitive', 'hurry'
  ];
  const foundUrgency = urgencyWords.filter(w => lower.includes(w));
  if (foundUrgency.length) {
    indicators.push({ key: 'urgency', description: `Urgency words: ${foundUrgency.join(', ')}` });
    score += 20;
  }

  // Requests for sensitive info
  const piiWords = [
    'password', 'account number', 'ssn', 'social security', 'card number',
    'cvv', 'pin', 'bank details', 'login credentials', 'verify identity',
    'date of birth', 'otp', 'one-time code', 'passport number',
    'driver’s license'
  ];
  const foundPII = piiWords.filter(w => lower.includes(w));
  if (foundPII.length) {
    indicators.push({ key: 'pii', description: `Sensitive info requested: ${foundPII.join(', ')}` });
    score += 25;
  }

  // Prize / money
  const prizeWords = [
    'lottery', 'winner', 'prize', 'claim', 'free money',
    'jackpot', 'congratulations', 'guaranteed win', 'cash reward',
    'gift card', 'bonus', 'redeem', 'reward points'
  ];
  const foundPrize = prizeWords.filter(w => lower.includes(w));
  if (foundPrize.length) {
    indicators.push({ key: 'prize', description: `Prize-related words: ${foundPrize.join(', ')}` });
    score += 15;
  }

  // Threats / authority impersonation
  const threatWords = [
    'suspended', 'terminated', 'account locked', 'fine', 'lawsuit',
    'irs', 'fbi', 'police', 'customs', 'paypal support', 'apple support',
    'bank security', 'unauthorized access', 'fraudulent activity',
    'legal action', 'court summons'
  ];
  const foundThreats = threatWords.filter(w => lower.includes(w));
  if (foundThreats.length) {
    indicators.push({ key: 'threat', description: `Threat/authority words: ${foundThreats.join(', ')}` });
    score += 25;
  }

  // Financial scam / investment
  const moneyWords = [
    'investment opportunity', 'guaranteed returns', 'double your money',
    'crypto giveaway', 'wire transfer', 'western union', 'bitcoin wallet',
    'forex trading', 'get rich quick', 'binary options', 'high yield'
  ];
  const foundMoney = moneyWords.filter(w => lower.includes(w));
  if (foundMoney.length) {
    indicators.push({ key: 'money', description: `Financial scam words: ${foundMoney.join(', ')}` });
    score += 20;
  }

  // Shopping / delivery scams
  const shoppingWords = [
    'free trial', 'subscription expired', 'renew membership',
    'package pending', 'delivery failed', 'shipping fee',
    'order confirmation', 'payment required', 'tracking number',
    'customs fee', 'amazon gift card', 'walmart voucher', 'fedex', 'dhl', 'ups'
  ];
  const foundShopping = shoppingWords.filter(w => lower.includes(w));
  if (foundShopping.length) {
    indicators.push({ key: 'shopping', description: `Shopping/delivery scam words: ${foundShopping.join(', ')}` });
    score += 15;
  }

  // Romance scams
  const romanceWords = [
    'soulmate', 'true love', 'lonely', 'dating site', 'romance',
    'chat now', 'sugar daddy', 'marriage proposal', 'urgent help',
    'family emergency', 'hospital bills'
  ];
  const foundRomance = romanceWords.filter(w => lower.includes(w));
  if (foundRomance.length) {
    indicators.push({ key: 'romance', description: `Romance scam words: ${foundRomance.join(', ')}` });
    score += 15;
  }

  // Health scams
  const healthWords = [
    'miracle cure', 'weight loss', 'lose 20 pounds', 'no prescription',
    'cheap meds', 'free trial pills', 'covid compensation',
    'insurance claim', 'cancer cure', 'hair growth', 'male enhancement'
  ];
  const foundHealth = healthWords.filter(w => lower.includes(w));
  if (foundHealth.length) {
    indicators.push({ key: 'health', description: `Health scam words: ${foundHealth.join(', ')}` });
    score += 15;
  }

  // Clamp score
  if (score > 100) score = 100;

  let level = 'Low';
  if (score >= 70) level = 'High';
  else if (score >= 40) level = 'Medium';

  return { score, level, indicators };
};
