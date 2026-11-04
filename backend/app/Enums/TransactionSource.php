<?php

namespace App\Enums;

enum TransactionSource: string
{
    case Manual = 'manual';
    case Csv = 'csv';
    case Ocr = 'ocr';
}
