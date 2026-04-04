export type SalaryCoachSection = {
  title: string;
  content: string;
};

export type SalaryCoachResult = {
  market_rate: string;
  market_note: string;
  counteroffer: string;
  sections: SalaryCoachSection[];
};
