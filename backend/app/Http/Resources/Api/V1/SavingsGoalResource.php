<?php

namespace App\Http\Resources\Api\V1;

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

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'name' => $this->name,
            'target_amount' => $this->target_amount,
            'current_amount' => number_format($saved, 2, '.', ''),
            'progress_percentage' => $target > 0 ? round(min(100, $saved / $target * 100), 1) : 0,
            'currency' => $this->currency,
            'target_date' => $this->target_date?->toDateString(),
            'status' => $this->status->value,
            'contributions' => $this->whenLoaded('contributions', fn () => $this->contributions->map(fn ($item): array => [
                'id' => $item->id,
                'amount' => $item->amount,
                'contributed_on' => $item->contributed_on->toDateString(),
                'notes' => $item->notes,
            ])->values()),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
