import { Category, Athlete } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  message: string;
  calculatedAgeSum: number;
  athleteAges: number[];
}

export interface ResolvedCategoryRules {
  maxAthletes: number;
  gender: 'male' | 'female' | 'mixed_1m_1f' | 'mixed_2m_2f' | 'open';
  genderLabel: string;
  minIndividualAge?: number;
  maxIndividualAge?: number;
  minSumTeamAge?: number;
  ageRuleType: 'none' | 'min_individual_age' | 'max_individual_age' | 'sum_team_age';
}

export function calculateAge(birthDateStr?: string): number {
  if (!birthDateStr) return 0;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function resolveCategoryRules(category: any): ResolvedCategoryRules {
  if (!category) {
    return {
      maxAthletes: 1,
      gender: 'open',
      genderLabel: 'Aberto',
      ageRuleType: 'none',
    };
  }

  // 1. Quantidade de atletas requeridos
  let maxAthletes = 1;
  const rawFormat = String(category.teamFormat || category.teamType || '').toLowerCase();
  const rawMax = Number(category.maxAthletesPerTeam ?? category.maxAthletes ?? category.maxAthlete);

  if (rawFormat === 'duo') maxAthletes = 2;
  else if (rawFormat === 'trio') maxAthletes = 3;
  else if (rawFormat === 'quartet') maxAthletes = 4;
  else if (rawFormat === 'individual') maxAthletes = 1;
  else if (!isNaN(rawMax) && rawMax > 0) maxAthletes = rawMax;
  else {
    const nameUpper = String(category.name || '').toUpperCase();
    if (nameUpper.includes('DUPLA') || nameUpper.includes('DUO')) maxAthletes = 2;
    else if (nameUpper.includes('TRIO')) maxAthletes = 3;
    else if (nameUpper.includes('QUARTET') || nameUpper.includes('4X')) maxAthletes = 4;
    else maxAthletes = 1;
  }

  // 2. Composição de gênero
  const genderRaw = String(category.genderComposition || category.genderRule || category.gender || '').toLowerCase();
  const nameUpper = String(category.name || '').toUpperCase();

  let gender: 'male' | 'female' | 'mixed_1m_1f' | 'mixed_2m_2f' | 'open' = 'open';
  if (genderRaw === 'male' || genderRaw === 'masculino') gender = 'male';
  else if (genderRaw === 'female' || genderRaw === 'feminino') gender = 'female';
  else if (genderRaw === 'mixed_1m_1f' || genderRaw === 'mixed_2m_2f' || genderRaw === 'mixed' || genderRaw === 'misto') {
    gender = maxAthletes === 4 ? 'mixed_2m_2f' : 'mixed_1m_1f';
  } else {
    // Inferência pelo nome da categoria
    if (nameUpper.includes('FEMININ') || nameUpper.includes('FEMALE') || nameUpper.includes('WOMEN') || nameUpper.includes('MULHER')) {
      gender = 'female';
    } else if (nameUpper.includes('MASCULIN') || nameUpper.includes('MALE') || nameUpper.includes('MEN') || nameUpper.includes('HOMEM')) {
      gender = 'male';
    } else if (nameUpper.includes('MIST') || nameUpper.includes('MIXED')) {
      gender = maxAthletes === 4 ? 'mixed_2m_2f' : 'mixed_1m_1f';
    } else {
      gender = 'open';
    }
  }

  const genderLabel = gender === 'female' ? 'Feminino'
    : gender === 'male' ? 'Masculino'
    : gender.startsWith('mixed') ? 'Misto'
    : 'Aberto';

  // 3. Regras de idade
  const rawAgeRule = typeof category.ageRule === 'string' ? category.ageRule : '';
  const minIndAge = category.minIndividualAge ?? category.ageRule?.minAge;
  const maxIndAge = category.maxIndividualAge ?? category.ageRule?.maxAge;
  const sumTeamAge = category.minSumTeamAge ?? category.minTeamSumAge ?? category.ageRule?.sumAge;

  let ageRuleType: 'none' | 'min_individual_age' | 'max_individual_age' | 'sum_team_age' = 'none';
  if (sumTeamAge || rawAgeRule === 'sum_team_age') ageRuleType = 'sum_team_age';
  else if (minIndAge || rawAgeRule === 'min_individual_age') ageRuleType = 'min_individual_age';
  else if (maxIndAge || rawAgeRule === 'max_individual_age') ageRuleType = 'max_individual_age';

  return {
    maxAthletes,
    gender,
    genderLabel,
    minIndividualAge: minIndAge ? Number(minIndAge) : undefined,
    maxIndividualAge: maxIndAge ? Number(maxIndAge) : undefined,
    minSumTeamAge: sumTeamAge ? Number(sumTeamAge) : undefined,
    ageRuleType,
  };
}

export function validateTeamAgainstCategoryRules(
  category: Category,
  athletes: Athlete[]
): ValidationResult {
  const rules = resolveCategoryRules(category);
  const athleteAges = athletes.map(a => a.age || calculateAge(a.birthDate));
  const calculatedAgeSum = athleteAges.reduce((acc, age) => acc + age, 0);

  // 1. Validar Quantidade de Integrantes
  if (athletes.length !== rules.maxAthletes) {
    return {
      isValid: false,
      message: `A categoria "${category.name}" exige exatamente ${rules.maxAthletes} atleta(s). Atualmente foram informados ${athletes.length}.`,
      calculatedAgeSum,
      athleteAges
    };
  }

  // 2. Validar Composição de Gênero
  const maleCount = athletes.filter(a => a.gender === 'M').length;
  const femaleCount = athletes.filter(a => a.gender === 'F').length;

  if (rules.gender === 'male' && femaleCount > 0) {
    return {
      isValid: false,
      message: `A categoria "${category.name}" é exclusivamente Masculina.`,
      calculatedAgeSum,
      athleteAges
    };
  }

  if (rules.gender === 'female' && maleCount > 0) {
    return {
      isValid: false,
      message: `A categoria "${category.name}" é exclusivamente Feminina.`,
      calculatedAgeSum,
      athleteAges
    };
  }

  if (rules.gender === 'mixed_1m_1f') {
    if (maleCount !== 1 || femaleCount !== 1) {
      return {
        isValid: false,
        message: `A Dupla Mista exige obrigatoriamente 1 Homem e 1 Mulher.`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  if (rules.gender === 'mixed_2m_2f') {
    if (maleCount !== 2 || femaleCount !== 2) {
      return {
        isValid: false,
        message: `O Quarteto Misto exige obrigatoriamente 2 Homens e 2 Mulheres.`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  // 3. Validar Regras de Idade
  if (rules.minSumTeamAge) {
    if (calculatedAgeSum < rules.minSumTeamAge) {
      return {
        isValid: false,
        message: `A soma de idades da equipe é de ${calculatedAgeSum} anos, mas a categoria exige soma mínima de ${rules.minSumTeamAge} anos (Faltam ${rules.minSumTeamAge - calculatedAgeSum} anos).`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  if (rules.minIndividualAge) {
    const invalidAthlete = athletes.find(a => (a.age || calculateAge(a.birthDate)) < rules.minIndividualAge!);
    if (invalidAthlete) {
      const currentAge = invalidAthlete.age || calculateAge(invalidAthlete.birthDate);
      return {
        isValid: false,
        message: `O atleta "${invalidAthlete.name}" tem ${currentAge} anos, mas a categoria exige idade mínima de ${rules.minIndividualAge} anos.`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  if (rules.maxIndividualAge) {
    const invalidAthlete = athletes.find(a => (a.age || calculateAge(a.birthDate)) > rules.maxIndividualAge!);
    if (invalidAthlete) {
      const currentAge = invalidAthlete.age || calculateAge(invalidAthlete.birthDate);
      return {
        isValid: false,
        message: `O atleta "${invalidAthlete.name}" tem ${currentAge} anos, mas a categoria permite idade máxima de até ${rules.maxIndividualAge} anos.`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  return {
    isValid: true,
    message: `Equipe validada com sucesso! (Soma de idades: ${calculatedAgeSum} anos).`,
    calculatedAgeSum,
    athleteAges
  };
}
