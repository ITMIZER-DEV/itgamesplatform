export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN', // Dono da Plataforma / SaaS Owner (Acesso total e faturamento)
  ORGANIZER = 'ORGANIZER',     // Organizador do Evento / Head Judge (Gestão do Evento, Baterias e Homologação)
  JUDGE = 'JUDGE',             // Árbitro de Campo (Lançamento de Score, Cronômetro e Fotos)
  ATHLETE = 'ATHLETE',         // Competidor (Consulta de Baterias, Scores e Contestação)
}
