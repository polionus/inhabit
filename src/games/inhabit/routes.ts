import { href as baseHref, navigate } from '../../template/router.ts';

export { navigate };

export const href = {
  ...baseHref,
  arena: (sub?: string, arg?: string) => baseHref.extra('arena', sub, arg),
  practice: (id?: string) => baseHref.extra('practice', id),
  share: (code?: string) => baseHref.extra('share', code),
  sandbox: () => baseHref.extra('sandbox'),
  workshop: () => baseHref.extra('workshop'),
  graduate: () => baseHref.extra('graduate'),
};
