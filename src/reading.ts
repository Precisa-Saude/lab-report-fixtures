/** Gabarito do que está impresso, independente de FHIR e do extrator. */
export interface LabReading {
  abnormal?: boolean;
  calculated?: boolean;
  code: string;
  comparator?: '<' | '>';
  display: string;
  flag: '' | 'H' | 'L';
  isQualitative?: boolean;
  labCode: string;
  label: string;
  loinc?: string;
  page: number;
  panel: string;
  previous?: { date: string; display: string; flag: '' | 'H' | 'L'; value: number };
  referenceMax?: number;
  referenceMin?: number;
  referenceText: string;
  unit: string;
  value: number | string;
}
