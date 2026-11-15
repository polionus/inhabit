/**
 * Stub: replaced by the practice agent. FROZEN props (the level screen renders this in three places).
 *
 * Offers generated practice tied to a level, and renders NOTHING when the generator cannot cover
 * that level's topic.
 *   when = 'after'    on the success card: "Practice this: three more like it"
 *   when = 'stuck'    in the stuck panel, after hints: "Try a smaller version first"
 *   when = 'studied'  after the solution was shown: "Prove one like it yourself"
 */
export interface PracticeOfferProps {
  levelId: string;
  when: 'after' | 'stuck' | 'studied';
}

export function PracticeOffer(_props: PracticeOfferProps) {
  return null;
}
