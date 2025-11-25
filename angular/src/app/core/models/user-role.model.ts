export type UserRole = 'presidente' | 'administrador' | 'secretaria' | 'tesorero' | 'socio';

export const USER_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'presidente', label: 'Presidente' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'tesorero', label: 'Tesorero' },
  { value: 'socio', label: 'Socio' }
];

export const USER_ROLE_LABELS: Record<UserRole, string> = USER_ROLE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<UserRole, string>
);
