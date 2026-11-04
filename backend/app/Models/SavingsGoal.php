<?php

namespace App\Models;

use App\Enums\SavingsFrequency;
use App\Enums\SavingsGoalKind;
use App\Enums\SavingsGoalStatus;
use App\Enums\SavingsProgressUnit;
use Database\Factories\SavingsGoalFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'kind',
    'name',
    'icon',
    'target_amount',
    'currency',
    'target_date',
    'saving_frequency',
    'progress_unit',
    'challenge_template',
    'status',
])]
class SavingsGoal extends Model
{
    /** @use HasFactory<SavingsGoalFactory> */
    use HasFactory, HasUuids;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<GoalContribution, $this> */
    public function contributions(): HasMany
    {
        return $this->hasMany(GoalContribution::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'kind' => SavingsGoalKind::class,
            'status' => SavingsGoalStatus::class,
            'saving_frequency' => SavingsFrequency::class,
            'progress_unit' => SavingsProgressUnit::class,
            'target_amount' => 'decimal:2',
            'target_date' => 'date',
        ];
    }
}
