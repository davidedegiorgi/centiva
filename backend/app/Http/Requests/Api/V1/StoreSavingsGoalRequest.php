<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\SavingsGoalKind;
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
            'target_amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999999999.99'],
            'currency' => ['required', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'target_date' => ['nullable', 'date'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'kind.required' => 'Scegli se creare un obiettivo o una challenge.',
            'name.required' => 'Il nome è obbligatorio.',
            'target_amount.required' => "L'importo obiettivo è obbligatorio.",
            'target_amount.gt' => "L'importo obiettivo deve essere maggiore di zero.",
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('currency')) {
            $this->merge(['currency' => Str::upper($this->string('currency')->toString())]);
        }
    }
}
