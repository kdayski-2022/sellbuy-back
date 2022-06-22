export const TOMORROW = 'Tomorrow'
export const WEEK = 'Week'
export const TWO_WEEK = 'TwoWeek'
export const MONTH = 'Month'

export const getCurrentDay = () =>{
    const day = new Date()
    const currentDayOfWeek = new  Date(day.setDate(day.getDate() - day.getDay())).getTime()
    return currentDayOfWeek
}

export const getLastDay = () =>{
    const day = new Date()
    const lastDayOfWeek = new Date(day.setDate(day.getDate() - day.getDay() + 6)).getTime()
    return lastDayOfWeek
}

export const getFutureTimestamp = (chooseableDay) =>{
    const day = new Date()
    switch(chooseableDay){
        case TOMORROW:
            const nextDayofWeek = new Date(day.setDate(day.getDate() + 1)).getTime()
            console.log(nextDayofWeek)
        return nextDayofWeek

        case WEEK:
            const week = new Date(day.setDate(day.getDate() + 7)).getTime()
            console.log(week)
        return week

        case TWO_WEEK:
            const twoWeek = new Date(day.setDate(day.getDate() + 14)).getTime()
            console.log(twoWeek)
        return twoWeek

        case MONTH:
            const month = new Date(day.setMonth(day.getMonth() + 1)).getTime()
            console.log(month)
        return month

        default:
            return day.getTime()
    }
}

//ТЗ сформировать current day of week и last day of week внутри запроса/ов где они используются
