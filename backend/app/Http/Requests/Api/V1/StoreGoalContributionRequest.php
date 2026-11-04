<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\SavingsProgressUnit;
use App\Models\SavingsGoal;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreGoalContributionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999999999.99'],
            'contributed_on' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'amount.required' => "L'importo da accantonare è obbligatorio.",
            'amount.gt' => "L'importo da accantonare deve essere maggiore di zero.",
            'contributed_on.required' => 'La data è obbligatoria.',
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $goal = $this->route('savingsGoal');

            if (! $goal instanceof SavingsGoal || $goal->progress_unit !== SavingsProgressUnit::Days) {
                return;
            }

            if ($validator->errors()->hasAny(['amount', 'contributed_on'])) {
                return;
            }

            if ((float) $this->input('amount') !== 1.0) {
                $validator->errors()->add('amount', 'Per questa challenge puoi confermare un giorno alla volta.');
            }

            if ($goal->contributions()->whereDate('contributed_on', $this->date('contributed_on'))->exists()) {
                $validator->errors()->add('contributed_on', 'Hai già confermato questa giornata.');
            }
        }];
    }
}
