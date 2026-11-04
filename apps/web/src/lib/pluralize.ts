const pluralRules = new Intl.PluralRules("en");
const numberFormat = new Intl.NumberFormat("en");

/**
 * "1 event", "2 events", "1,204 events". The plural defaults to the singular plus "s"; pass it
 * for irregular words ("1 entry", "2 entries").
 */
function pluralize(count: number, singular: string, plural = `${singular}s`) {
  const word = pluralRules.select(count) === "one" ? singular : plural;
  return `${numberFormat.format(count)} ${word}`;
}

export { pluralize };
