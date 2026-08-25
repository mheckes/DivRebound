/**
 * Teilt Distributions in SubmissionChunks auf (max. `maxPerClaim` je Chunk,
 * z.B. 20 bei DK). Chronologisch aufsteigend (älteste zuerst), wie im
 * Flow-Diagramm gefordert: "Automatische Aufteilung ... chronologisch,
 * älteste zuerst".
 * @param {Distribution[]} distributions
 * @param {number} maxPerClaim
 * @returns {SubmissionChunk[]}
 */
export function buildSubmissionChunks(distributions, maxPerClaim) {
  const sorted = [...distributions].sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));
  const chunks = [];
  for (let i = 0; i < sorted.length; i += maxPerClaim) {
    chunks.push({
      chunkIndex: chunks.length + 1,
      distributionIds: sorted.slice(i, i + maxPerClaim).map((d) => d.distributionId),
      status: "pending",
      tickedRowIds: [],
    });
  }
  return chunks;
}
