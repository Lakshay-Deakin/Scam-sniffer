// src/utils/analyzer.js
module.exports = function analyzeText(text) {
  const indicators = [];
  let score = 0;

  const lower = text.toLowerCase();
  console.log("Analyzing text:", text);

  // External links
  const linkRegex = /(https?:\/\/|www\.)\S+/i;
  if (linkRegex.test(text)) {
    indicators.push({ key: 'links', description: 'Contains external links' });
    score += 30;
  }

  // Urgency words
  const urgencyWords = [
    'urgent', 'immediately', 'asap', 'act now', 'deadline',
    'final notice', 'limited time', 'respond quickly', 'within 24 hours'
  ];
  const foundUrgency = urgencyWords.filter(w => lower.includes(w));
  if (foundUrgency.length) {
    indicators.push({ key: 'urgency', description: `Urgency words: ${foundUrgency.join(', ')}` });
    score += 20;
  }

  // Requests for sensitive info
  const piiWords = [
    'password', 'account number', 'ssn', 'social security', 'card number',
    'cvv', 'pin', 'bank details', 'login credentials', 'verify identity'
  ];
  const foundPII = piiWords.filter(w => lower.includes(w));
  if (foundPII.length) {
    indicators.push({ key: 'pii', description: `Sensitive info requested: ${foundPII.join(', ')}` });
    score += 25;
  }

  // Prize / money
  const prizeWords = [
    'lottery', 'winner', 'prize', 'claim', 'free money',
    'jackpot', 'congratulations', 'guaranteed win', 'cash reward'
  ];
  const foundPrize = prizeWords.filter(w => lower.includes(w));
  if (foundPrize.length) {
    indicators.push({ key: 'prize', description: `Prize-related words: ${foundPrize.join(', ')}` });
    score += 15;
  }

  // Threats / authority impersonation
  const threatWords = [
    'suspended', 'terminated', 'account locked', 'fine', 'lawsuit',
    'irs', 'fbi', 'police', 'paypal support', 'bank security',
    'risk', 'unauthorized access', 'fraudulent activity'
  ];
  const foundThreats = threatWords.filter(w => lower.includes(w));
  if (foundThreats.length) {
    indicators.push({ key: 'threat', description: `Threat/authority words: ${foundThreats.join(', ')}` });
    score += 25;
  }

  // Financial scam / investment
  const moneyWords = [
    'investment opportunity', 'guaranteed returns', 'double your money',
    'crypto giveaway', 'wire transfer', 'western union', 'bitcoin wallet'
  ];
  const foundMoney = moneyWords.filter(w => lower.includes(w));
  if (foundMoney.length) {
    indicators.push({ key: 'money', description: `Financial scam words: ${foundMoney.join(', ')}` });
    score += 20;
  }

  // Clamp score
  if (score > 100) score = 100;

  let level = 'Low';
  if (score >= 70) level = 'High';
  else if (score >= 40) level = 'Medium';

  return { score, level, indicators };
};
