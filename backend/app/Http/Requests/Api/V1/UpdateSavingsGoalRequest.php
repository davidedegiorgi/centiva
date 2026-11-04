<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\SavingsGoalKind;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateSavingsGoalRequest extends FormRequest
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
            'kind' => ['sometimes', 'required', Rule::enum(SavingsGoalKind::class)],
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'target_amount' => ['sometimes', 'required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999999999.99'],
            'currency' => ['sometimes', 'required', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'target_date' => ['sometimes', 'nullable', 'date'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('currency')) {
            $this->merge(['currency' => Str::upper($this->string('currency')->toString())]);
        }
    }
}
