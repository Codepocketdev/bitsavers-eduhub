import { useState, useCallback } from 'react'

export function useForm(initialValues = {}, validate = () => ({})) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setValues(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (touched[name]) {
      const fieldErrors = validate({ ...values, [name]: type === 'checkbox' ? checked : value })
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }))
    }
  }, [values, touched, validate])

  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    const fieldErrors = validate(values)
    setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }))
  }, [values, validate])

  const handleSubmit = useCallback((onSubmit) => async (e) => {
    e?.preventDefault()
    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}))
    const validationErrors = validate(values)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length === 0) {
      setIsSubmitting(true)
      try {
        await onSubmit(values)
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [values, validate])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  return { values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit, reset, setValues }
}
