import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Check, Pencil, X } from 'lucide-react-native'

interface EditableRowProps {
    label: string
    displayValue: string
    editValue?: string
    placeholder?: string
    secureTextEntry?: boolean
    keyboardType?: TextInputProps[ 'keyboardType' ]
    autoComplete?: TextInputProps[ 'autoComplete' ]
    textContentType?: TextInputProps[ 'textContentType' ]
    validate: (value: string) => string | undefined
    onSave: (value: string) => Promise<void>
    isLast?: boolean
}

export function EditableRow({
    label,
    displayValue,
    editValue,
    placeholder,
    secureTextEntry,
    keyboardType,
    autoComplete,
    textContentType,
    validate,
    onSave,
    isLast,
}: EditableRowProps) {
    const [ isEditing, setIsEditing ] = useState(false)
    const [ draft, setDraft ] = useState(editValue ?? displayValue)
    const [ error, setError ] = useState<string | null>(null)
    const [ isSaving, setIsSaving ] = useState(false)

    function startEditing() {
        setDraft(editValue ?? displayValue)
        setError(null)
        setIsEditing(true)
    }

    function cancelEditing() {
        setIsEditing(false)
        setError(null)
    }

    async function save() {
        const validationError = validate(draft)
        if (validationError) {
            setError(validationError)
            return
        }

        setIsSaving(true)
        try {
            await onSave(draft)
            setIsEditing(false)
            setError(null)
        } catch {
            setError('Une erreur est survenue')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <View className={isLast ? 'gap-1.5 py-3' : 'gap-1.5 border-b border-border-subtle py-3'}>
            <View className="flex-row items-center gap-3">
                <View className="flex-1">
                    <Text className="text-[13px] text-content-secondary">{label}</Text>
                    {isEditing ? (
                        <TextInput
                            className="h-7 p-0 text-[16px] font-semibold text-content-primary"
                            value={draft}
                            onChangeText={setDraft}
                            placeholder={placeholder}
                            placeholderTextColor="#EBEBF54D"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus
                            secureTextEntry={secureTextEntry}
                            keyboardType={keyboardType}
                            autoComplete={autoComplete}
                            textContentType={textContentType}
                            editable={!isSaving}
                        />
                    ) : (
                        <Text className="text-[16px] font-semibold text-content-primary">{displayValue}</Text>
                    )}
                </View>

                {isEditing ? (
                    isSaving ? (
                        <ActivityIndicator color="#409CFF" />
                    ) : (
                        <View className="flex-row gap-3">
                            <Pressable onPress={cancelEditing} hitSlop={8}>
                                <X size={20} color="#8E8E93" />
                            </Pressable>
                            <Pressable onPress={save} hitSlop={8}>
                                <Check size={20} color="#409CFF" />
                            </Pressable>
                        </View>
                    )
                ) : (
                    <Pressable onPress={startEditing} hitSlop={8}>
                        <Pencil size={18} color="#8E8E93" />
                    </Pressable>
                )}
            </View>
            {error ? <Text className="text-[12px] text-danger">{error}</Text> : null}
        </View>
    )
}
