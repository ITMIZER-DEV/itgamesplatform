import { Category, Athlete } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  message: string;
  calculatedAgeSum: number;
  athleteAges: number[];
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

export function validateTeamAgainstCategoryRules(
  category: Category,
  athletes: Athlete[]
): ValidationResult {
  const athleteAges = athletes.map(a => a.age || calculateAge(a.birthDate));
  const calculatedAgeSum = athleteAges.reduce((acc, age) => acc + age, 0);

  // 1. Validar Quantidade de Integrantes
  if (athletes.length !== category.maxAthletesPerTeam) {
    return {
      isValid: false,
      message: `A categoria "${category.name}" exige exatamente ${category.maxAthletesPerTeam} atleta(s). Atualmente foram informados ${athletes.length}.`,
      calculatedAgeSum,
      athleteAges
    };
  }

  // 2. Validar Composição de Gênero
  const maleCount = athletes.filter(a => a.gender === 'M').length;
  const femaleCount = athletes.filter(a => a.gender === 'F').length;

  if (category.genderComposition === 'male' && femaleCount > 0) {
    return {
      isValid: false,
      message: `A categoria "${category.name}" é exclusivamente Masculina.`,
      calculatedAgeSum,
      athleteAges
    };
  }

  if (category.genderComposition === 'female' && maleCount > 0) {
    return {
      isValid: false,
      message: `A categoria "${category.name}" é exclusivamente Feminina.`,
      calculatedAgeSum,
      athleteAges
    };
  }

  if (category.genderComposition === 'mixed_1m_1f') {
    if (maleCount !== 1 || femaleCount !== 1) {
      return {
        isValid: false,
        message: `A Dupla Mista exige obrigatoriamente 1 Homem e 1 Mulher.`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  if (category.genderComposition === 'mixed_2m_2f') {
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
  // Caso 3.1: Soma de Idades da Equipe (Ex: Time Master 110+)
  if (category.ageRule === 'sum_team_age' && category.minSumTeamAge) {
    if (calculatedAgeSum < category.minSumTeamAge) {
      return {
        isValid: false,
        message: `A soma de idades da equipe é de ${calculatedAgeSum} anos, mas a categoria exige soma mínima de ${category.minSumTeamAge} anos (Faltam ${category.minSumTeamAge - calculatedAgeSum} anos).`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  // Caso 3.2: Idade Mínima Individual (Ex: Master 35+)
  if (category.ageRule === 'min_individual_age' && category.minIndividualAge) {
    const invalidAthlete = athletes.find(a => (a.age || calculateAge(a.birthDate)) < (category.minIndividualAge || 35));
    if (invalidAthlete) {
      const currentAge = invalidAthlete.age || calculateAge(invalidAthlete.birthDate);
      return {
        isValid: false,
        message: `O atleta "${invalidAthlete.name}" tem ${currentAge} anos, mas a categoria Master exige idade mínima de ${category.minIndividualAge} anos.`,
        calculatedAgeSum,
        athleteAges
      };
    }
  }

  // Caso 3.3: Idade Máxima Individual (Ex: Teen até 18 anos)
  if (category.ageRule === 'max_individual_age' && category.maxIndividualAge) {
    const invalidAthlete = athletes.find(a => (a.age || calculateAge(a.birthDate)) > (category.maxIndividualAge || 18));
    if (invalidAthlete) {
      const currentAge = invalidAthlete.age || calculateAge(invalidAthlete.birthDate);
      return {
        isValid: false,
        message: `O atleta "${invalidAthlete.name}" tem ${currentAge} anos, mas a categoria Teen permite idade máxima de até ${category.maxIndividualAge} anos.`,
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
