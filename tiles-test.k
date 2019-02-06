;!knitout-2
;;Carriers: A B C

; Knit structure that features all combinations of [0,1,2,3] yarns and [0,1,2,3] loops
; participating in all three of split/knit/drop

inhook A B C

tuck + f0
tuck + f1 A
tuck + f2 A B
tuck + f3 A B C

tuck - f3 A B C
tuck - f2 A B C
tuck - f1 A B C
tuck - f0 A B C

drop f0
drop f1
drop f2
drop f3

outhook A B C

inhook A B C

tuck + f0
tuck + f1 A
tuck + f2 A B
tuck + f3 A B C

tuck - f3 A B
tuck - f2 A B
tuck - f1 A B
tuck - f0 A B

drop f0
drop f1
drop f2
drop f3

outhook A B C

inhook A B C

tuck + f0
tuck + f1 A
tuck + f2 A B
tuck + f3 A B C

tuck - f3 A
tuck - f2 A
tuck - f1 A
tuck - f0 A

drop f0
drop f1
drop f2
drop f3

outhook A B C

inhook A B C

tuck + f0
tuck + f1 A
tuck + f2 A B
tuck + f3 A B C

tuck - f3
tuck - f2
tuck - f1
tuck - f0

drop f0
drop f1
drop f2
drop f3

outhook A B C
