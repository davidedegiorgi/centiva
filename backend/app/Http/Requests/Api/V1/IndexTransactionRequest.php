<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\TransactionType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexTransactionRequest extends FormRequest
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
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::enum(TransactionType::class)],
            'category' => ['nullable', 'string', 'max:100'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'amount_min' => ['nullable', 'numeric', 'gte:0'],
            'amount_max' => ['nullable', 'numeric', 'gte:amount_min'],
            'sort' => ['nullable', Rule::in(['occurred_on', 'amount', 'created_at'])],
            'order' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', Rule::in([10, 25, 50])],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'type.enum' => 'Il tipo di transazione non è valido.',
            'date_to.after_or_equal' => 'La data finale deve essere successiva a quella iniziale.',
            'amount_max.gte' => "L'importo massimo deve essere maggiore o uguale al minimo.",
            'sort.in' => 'Il campo di ordinamento non è valido.',
            'order.in' => "La direzione dell'ordinamento non è valida.",
            'per_page.in' => 'Il numero di risultati per pagina non è valido.',
        ];
    }
}
