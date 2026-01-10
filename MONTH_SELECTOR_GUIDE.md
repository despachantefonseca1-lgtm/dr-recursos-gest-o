# Implementação Simples do Seletor de Mês

Para completar o item 6 de forma simples, você pode adicionar o seguinte código ao arquivo `pages/Recursos/Caixa.tsx`:

## 1. Adicionar estado (linha ~23):

```tsx
// Monthly selector control  
const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
```

## 2. Modificar o filtro de serviços (substituir o filteredServicos existente ~linha 57):

```tsx
const filteredServicos = servicos.filter(s => {
    if (!s.data_contratacao) return false;
    const serviceMonth = s.data_contratacao.slice(0, 7); // YYYY-MM
    return serviceMonth === selectedMonth;
});
```

## 3. Adicionar funções auxiliares (antes do return ~linha 150):

```tsx
const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${monthNames[parseInt(month) - 1]} de ${year}`;
};

const handlePreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(prevDate.toISOString().slice(0, 7));
};

const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const today = new Date();
    if (nextDate <= today) {
        setSelectedMonth(nextDate.toISOString().slice(0, 7));
    }
};
```

## 4. Adicionar UI no header (substituir o header existente que tem os date inputs):

```tsx
<div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-6 shadow-lg text-white mb-6">
    <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-black">Fluxo de Caixa - Recursos</h2>
        <Button variant="outline" onClick={generateReport} className="bg-white text-indigo-600">
            📊 Exportar
        </Button>
    </div>
    
    <div className="flex items-center justify-center gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-lg">
        <Button variant="ghost" onClick={handlePreviousMonth} className="text-white hover:bg-white/20">
            ← Anterior
        </Button>
        
        <div className="text-center px-8">
            <p className="text-sm font-medium opacity-90">Período</p>
            <p className="text-3xl font-black">{formatMonthYear(selectedMonth)}</p>
        </div>
        
        <Button 
            variant="ghost" 
            onClick={handleNextMonth}
            disabled={selectedMonth >= new Date().toISOString().slice(0, 7)}
            className="text-white hover:bg-white/20 disabled:opacity-30"
        >
            Próximo →
        </Button>
    </div>
</div>
```

## Resultado:
- ✅ Navegação entre meses
- ✅ Display bonito do mês/ano em português
- ✅ Filtro automático por mês selecionado
- ✅ Botão próximo desabilitado quando chegar no mês atual
