<?php

namespace App\Support;

/**
 * Mastery as a word rather than a number (§2.13).
 *
 * The parent card publishes the band and never the raw score, and the reports print the
 * same word beside the number, so both read their thresholds from here and cannot disagree.
 * The web and mobile clients mirror these thresholds for display only.
 */
final class MasteryBand
{
    /** Lower bound of each band, highest first. */
    public const BANDS = [90 => 'EXCELLENT', 75 => 'STRONG', 50 => 'DEVELOPING', 0 => 'NEEDS_WORK'];

    public static function for(?float $mastery): string
    {
        if ($mastery === null) {
            return 'NO_DATA';
        }
        foreach (self::BANDS as $floor => $band) {
            if ($mastery >= $floor) {
                return $band;
            }
        }

        return 'NEEDS_WORK';
    }
}
