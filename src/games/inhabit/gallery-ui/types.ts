/** Props every exhibit component receives. Exhibits must render well from 390px to wide screens, in both themes. */
export interface ExhibitProps {
  /** Optional preset passed via `#/gallery/<id>?…` is not supported; exhibits pick their own defaults. Reserved. */
  compact?: boolean;
}
