// Keep stored filter values and shared URLs compatible with existing results.
export const switchTypeLabel = type => type === "클릭키" ? "클릭" : type;

export const brandSignature = (legacyName, brandName) =>
  [legacyName, "by", brandName].filter(Boolean).join(" ");
