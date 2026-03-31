/**
 * Drop salary, legal boilerplate, and noise; keep skills, responsibilities, and requirements-like lines.
 */

const SALARY_RE =
  /\$\s*\d|\d{1,3}(?:,\d{3})+\s*(?:usd|gbp|eur)?|£\s*\d|€\s*\d|\d+\s*[-–]\s*\d+\s*k\b|\b(?:salary|compensation|pay range|base pay|OTE|equity package|per annum|\/yr|\/year|lakh|crore)\b/i;

const LEGAL_RE =
  /\b(?:EEO|equal opportunity|affirmative action|at-will|background check|drug screen|GDPR|privacy policy|cookie policy|terms of service|legally authorized to work|work authorization only|accommodation.*disability)\b/i;

const BOILERPLATE_RE =
  /\b(?:why join us\?|life at |our values|perks and benefits|we offer health|401\(k\)|dental insurance|unlimited PTO|apply today|don't see a role)\b/i;

const SKILL_OR_ROLE_RE =
  /\b(?:experience|years?|proficient|familiar|knowledge|ability|skills?|bachelor|master|ph\.?d|degree|certif|build|ship|design|develop|lead|own|deliver|stakeholder|cross-?functional|agile|scrum|kanban|python|java|react|angular|vue|node|typescript|javascript|aws|gcp|azure|kubernetes|docker|sql|api|graphql|rest|ci\/?cd|terraform|kafka|spark|ml|ai|data|frontend|backend|full[\s-]?stack|engineer|developer|architect|product|roadmap|testing|qa|security|observability)\b/i;

const RESP_REQ_RE =
  /\b(?:responsibilit|qualification|requirement|what you(?:'ll)?|you will|looking for|must have|nice to have|preferred|minimum)\b/i;

export function isMeaningfulJobRequirementLine(text: string): boolean {
  const t = text.trim();
  if (t.length < 18 || t.length > 260) return false;
  if (SALARY_RE.test(t)) return false;
  if (LEGAL_RE.test(t)) return false;
  if (BOILERPLATE_RE.test(t) && !SKILL_OR_ROLE_RE.test(t)) return false;
  return SKILL_OR_ROLE_RE.test(t) || RESP_REQ_RE.test(t);
}

export function filterMeaningfulRequirementStrings(items: string[]): string[] {
  return items.filter((s) => isMeaningfulJobRequirementLine(s));
}
