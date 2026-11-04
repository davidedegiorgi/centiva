<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\SavingsFrequency;
use App\Enums\SavingsGoalKind;
use App\Enums\SavingsProgressUnit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreSavingsGoalRequest extends FormRequest
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
            'kind' => ['required', Rule::enum(SavingsGoalKind::class)],
            'name' => ['required', 'string', 'max:160'],
            'icon' => ['required', 'string', Rule::in(['target', 'plane', 'car', 'shield', 'phone', 'home', 'education', 'gift', 'sparkles', 'calendar'])],
            'target_amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999999999.99'],
            'currency' => ['required', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'target_date' => ['nullable', 'date'],
            'saving_frequency' => ['nullable', Rule::enum(SavingsFrequency::class)],
            'progress_unit' => ['required', Rule::enum(SavingsProgressUnit::class)],
            'challenge_template' => ['nullable', 'string', Rule::in(['weekly_20', 'no_spend_3_days', 'category_reduction'])],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kind.required' => 'Scegli se creare un obiettivo o una challenge.',
            'name.required' => 'Il nome è obbligatorio.',
            'icon.required' => "Scegli un'icona per il percorso.",
            'target_amount.required' => "L'importo obiettivo è obbligatorio.",
            'target_amount.gt' => "L'importo obiettivo deve essere maggiore di zero.",
            'progress_unit.required' => "L'unità di avanzamento è obbligatoria.",
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'icon' => $this->input('icon', 'target'),
            'progress_unit' => $this->input('progress_unit', SavingsProgressUnit::Currency->value),
            'saving_frequency' => $this->input('saving_frequency', SavingsFrequency::Monthly->value),
        ]);

        if ($this->has('currency')) {
            $this->merge(['currency' => Str::upper($this->string('currency')->toString())]);
        }
    }
}
