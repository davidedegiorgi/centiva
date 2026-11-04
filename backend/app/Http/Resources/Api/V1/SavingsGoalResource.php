<?php

namespace App\Http\Resources\Api\V1;

use App\Enums\SavingsFrequency;
use App\Enums\SavingsGoalStatus;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SavingsGoalResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $saved = (float) ($this->contributions_sum_amount ?? $this->whenLoaded('contributions', fn () => $this->contributions->sum('amount'), 0));
        $target = (float) $this->target_amount;
        $progress = $target > 0 ? round(min(100, $saved / $target * 100), 1) : 0;
        $contributionCount = (int) ($this->contributions_count ?? $this->whenLoaded('contributions', fn () => $this->contributions->count(), 0));

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'name' => $this->name,
            'icon' => $this->icon,
            'target_amount' => $this->target_amount,
            'current_amount' => number_format($saved, 2, '.', ''),
            'progress_percentage' => $progress,
            'currency' => $this->currency,
            'target_date' => $this->target_date?->toDateString(),
            'saving_frequency' => $this->saving_frequency?->value,
            'progress_unit' => $this->progress_unit->value,
            'challenge_template' => $this->challenge_template,
            'status' => $this->status->value,
            'plan' => $this->plan($saved, $target),
            'badges' => $this->badges($progress, $contributionCount),
            'motivation' => $this->motivation($progress, $contributionCount),
            'contributions' => $this->whenLoaded('contributions', fn () => $this->contributions->map(fn ($item): array => [
                'id' => $item->id,
                'amount' => $item->amount,
                'contributed_on' => $item->contributed_on->toDateString(),
                'notes' => $item->notes,
            ])->values()),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }

    /** @return array<string, int|string>|null */
    private function plan(float $saved, float $target): ?array
    {
        if ($this->target_date === null || $this->saving_frequency === null) {
            return null;
        }

        $today = CarbonImmutable::now(config('app.timezone'))->startOfDay();
        $targetDate = CarbonImmutable::parse($this->target_date)->startOfDay();
        $startDate = CarbonImmutable::parse($this->created_at)->startOfDay();
        $remaining = max(0, $target - $saved);
        $daysRemaining = (int) ceil($today->diffInDays($targetDate, false));
        $periodLength = $this->saving_frequency === SavingsFrequency::Weekly ? 7 : 30.4375;
        $remainingPeriods = $daysRemaining > 0 ? max(1, (int) ceil($daysRemaining / $periodLength)) : 0;
        $recommended = $remainingPeriods > 0
            ? ceil(($remaining / $remainingPeriods) * 100) / 100
            : $remaining;

        $totalDays = max(1, (int) ceil($startDate->diffInDays($targetDate)));
        $elapsedDays = max(0, min($totalDays, (int) floor($startDate->diffInDays($today, false))));
        $expected = $target * ($elapsedDays / $totalDays);
        $paceStatus = match (true) {
            $this->status === SavingsGoalStatus::Completed => 'completed',
            $daysRemaining < 0 => 'overdue',
            $saved + ($target * 0.05) >= $expected => 'on_track',
            default => 'behind',
        };

        return [
            'recommended_amount' => number_format($recommended, 2, '.', ''),
            'frequency' => $this->saving_frequency->value,
            'remaining_periods' => $remainingPeriods,
            'days_remaining' => max(0, $daysRemaining),
            'pace_status' => $paceStatus,
        ];
    }

    /** @return array<int, array{key: string, label: string}> */
    private function badges(float $progress, int $contributionCount): array
    {
        $badges = [];

        if ($contributionCount > 0) {
            $badges[] = ['key' => 'first_contribution', 'label' => 'Primo accantonamento'];
        }

        foreach ([25, 50, 100] as $threshold) {
            if ($progress >= $threshold) {
                $badges[] = ['key' => "progress_{$threshold}", 'label' => "{$threshold}% raggiunto"];
            }
        }

        return $badges;
    }

    private function motivation(float $progress, int $contributionCount): string
    {
        return match (true) {
            $progress >= 100 => 'Traguardo raggiunto. Il percorso resta registrato qui.',
            $progress >= 50 => 'Hai superato metà percorso: continua con il tuo ritmo.',
            $progress >= 25 => 'Il progresso è concreto. Ogni accantonamento conta.',
            $contributionCount > 0 => 'Ottimo inizio. Mantieni la costanza senza forzature.',
            default => 'Quando metti davvero qualcosa da parte, registralo qui.',
        };
    }
}
